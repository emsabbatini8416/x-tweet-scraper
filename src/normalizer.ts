import type { TweetMedia, TweetOutput } from './types.js';
import {
  asNumber,
  asRecord,
  asString,
  getPath,
  isRecord,
  toIsoTimestamp,
  type UnknownRecord,
} from './utils.js';

function unwrapTweet(value: unknown): UnknownRecord | null {
  let record = asRecord(value);
  for (let depth = 0; record !== null && depth < 4; depth += 1) {
    if (asRecord(record.legacy) !== null && asString(record.rest_id) !== null) return record;
    record = asRecord(record.tweet);
  }
  return null;
}

function stringArray(value: unknown, key: string): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const text = asString(asRecord(item)?.[key]);
    return text === null ? [] : [text];
  });
}

function normalizeMedia(value: unknown): TweetMedia[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): TweetMedia[] => {
    const media = asRecord(item);
    const type = asString(media?.type);
    if (media === null || (type !== 'photo' && type !== 'video' && type !== 'animated_gif')) {
      return [];
    }

    const preview = asString(media.media_url_https) ?? asString(media.media_url);
    if (type === 'photo') {
      if (preview === null) return [];
      return [{ type, url: preview, thumbnail: null }];
    }

    const variants = getPath(media, ['video_info', 'variants']);
    const mp4Variants = Array.isArray(variants)
      ? variants
          .map((variant) => asRecord(variant))
          .filter(
            (variant): variant is UnknownRecord =>
              variant !== null &&
              asString(variant.content_type) === 'video/mp4' &&
              asString(variant.url) !== null,
          )
          .sort((a, b) => (asNumber(b.bitrate) ?? 0) - (asNumber(a.bitrate) ?? 0))
      : [];
    const url = asString(mp4Variants[0]?.url) ?? preview;
    if (url === null) return [];
    return [{ type, url, thumbnail: preview }];
  });
}

function unescapeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function expandAndUnescapeText(text: string, urls: unknown): string {
  let expanded = text;
  if (Array.isArray(urls)) {
    for (const item of urls) {
      const entity = asRecord(item);
      const shortUrl = asString(entity?.url);
      const fullUrl = asString(entity?.expanded_url);
      if (shortUrl !== null && fullUrl !== null && shortUrl !== '') {
        expanded = expanded.split(shortUrl).join(fullUrl);
      }
    }
  }
  return unescapeHtml(expanded);
}

function cleanSource(value: unknown): string | null {
  const source = asString(value);
  if (source === null) return null;
  return source.replace(/<[^>]*>/g, '').trim() || null;
}

export function normalizeTweet(
  raw: unknown,
  scrapedAt = new Date().toISOString(),
): TweetOutput | null {
  const tweet = unwrapTweet(raw);
  if (tweet === null) return null;
  const legacy = asRecord(tweet.legacy);
  const id = asString(tweet.rest_id);
  const createdAt = toIsoTimestamp(legacy?.created_at);
  if (legacy === null || id === null || createdAt === null) return null;

  const user = asRecord(getPath(tweet, ['core', 'user_results', 'result']));
  const userLegacy = asRecord(user?.legacy);
  const authorId = asString(user?.rest_id);
  const username = asString(userLegacy?.screen_name);
  const name = asString(userLegacy?.name);
  if (user === null || userLegacy === null || authorId === null || username === null || name === null) {
    return null;
  }

  const entities = asRecord(legacy.entities);
  const extendedEntities = asRecord(legacy.extended_entities);
  const media = normalizeMedia(extendedEntities?.media ?? entities?.media);
  const rawText =
    asString(getPath(tweet, ['note_tweet', 'note_tweet_results', 'result', 'text'])) ??
    asString(legacy.full_text) ??
    '';
  const text = expandAndUnescapeText(rawText, entities?.urls);
  const inReplyToId = asString(legacy.in_reply_to_status_id_str);
  const quotedTweetId = asString(legacy.quoted_status_id_str);
  const isRetweet = asRecord(legacy.retweeted_status_result) !== null || text.startsWith('RT @');

  return {
    id,
    url: `https://x.com/${username}/status/${id}`,
    text,
    lang: asString(legacy.lang),
    createdAt,
    conversationId: asString(legacy.conversation_id_str),
    isReply: inReplyToId !== null,
    isRetweet,
    isQuote: quotedTweetId !== null,
    inReplyToId,
    quotedTweetId,
    author: {
      id: authorId,
      username,
      name,
      verified: user.is_blue_verified === true || userLegacy.verified === true,
      followers: asNumber(userLegacy.followers_count) ?? 0,
      following: asNumber(userLegacy.friends_count) ?? 0,
    },
    metrics: {
      likes: asNumber(legacy.favorite_count) ?? 0,
      retweets: asNumber(legacy.retweet_count) ?? 0,
      replies: asNumber(legacy.reply_count) ?? 0,
      quotes: asNumber(legacy.quote_count) ?? 0,
      bookmarks: asNumber(legacy.bookmark_count),
      views: asNumber(getPath(tweet, ['views', 'count'])),
    },
    entities: {
      hashtags: stringArray(entities?.hashtags, 'text'),
      mentions: stringArray(entities?.user_mentions, 'screen_name'),
      urls: stringArray(entities?.urls, 'expanded_url'),
      media,
    },
    source: cleanSource(legacy.source),
    scrapedAt,
  };
}

function walk(value: unknown, visit: (record: UnknownRecord) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  if (!isRecord(value)) return;
  visit(value);
  for (const child of Object.values(value)) walk(child, visit);
}

export function extractTweets(payload: unknown): TweetOutput[] {
  const tweets = new Map<string, TweetOutput>();
  const scrapedAt = new Date().toISOString();

  const collect = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) collect(item);
      return;
    }
    if (!isRecord(value)) return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'tweet_results' || key === 'tweetResult') {
        const tweet = normalizeTweet(asRecord(child)?.result, scrapedAt);
        if (tweet !== null) tweets.set(tweet.id, tweet);
      } else {
        collect(child);
      }
    }
  };

  collect(payload);
  return [...tweets.values()];
}

export function extractUserId(payload: unknown): string | null {
  let result: string | null = null;
  walk(payload, (record) => {
    if (result !== null) return;
    const legacy = asRecord(record.legacy);
    if (
      asString(record.rest_id) !== null &&
      asString(legacy?.screen_name) !== null &&
      asString(legacy?.full_text) === null
    ) {
      result = asString(record.rest_id);
    }
  });
  return result;
}

export function extractBottomCursor(payload: unknown): string | null {
  let cursor: string | null = null;
  walk(payload, (record) => {
    if (cursor !== null) return;
    const cursorType = asString(record.cursorType);
    const entryId = asString(record.entryId);
    if (cursorType === 'Bottom' || entryId?.startsWith('cursor-bottom-') === true) {
      cursor = asString(record.value);
    }
  });
  return cursor;
}
