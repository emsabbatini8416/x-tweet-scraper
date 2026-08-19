import { describe, expect, it } from 'vitest';

import { matchesFilters, type TweetFilters } from '../src/filters.js';
import type { TweetOutput } from '../src/types.js';

const tweet: TweetOutput = {
  id: '1',
  url: 'https://x.com/apify/status/1',
  text: 'Hello #Apify',
  lang: 'en',
  createdAt: '2026-01-15T12:00:00.000Z',
  conversationId: '1',
  isReply: false,
  isRetweet: false,
  isQuote: false,
  inReplyToId: null,
  quotedTweetId: null,
  author: {
    id: '2',
    username: 'apify',
    name: 'Apify',
    verified: true,
    followers: 100,
    following: 10,
  },
  metrics: { likes: 20, retweets: 10, replies: 5, quotes: 2, bookmarks: 3, views: 500 },
  entities: {
    hashtags: ['Apify', 'WebScraping'],
    mentions: [],
    urls: ['https://apify.com'],
    media: [{ type: 'photo', url: 'https://img.example/a.jpg', thumbnail: null }],
  },
  source: 'Twitter Web App',
  scrapedAt: '2026-01-15T12:01:00.000Z',
};

const filters: TweetFilters = {
  hashtags: [],
  since: null,
  until: null,
  language: null,
  minLikes: null,
  minRetweets: null,
  minReplies: null,
  onlyVerified: false,
  mediaType: 'any',
  includeReplies: true,
  includeRetweets: true,
};

describe('matchesFilters', () => {
  it('uses AND semantics for active filters', () => {
    expect(
      matchesFilters(tweet, {
        ...filters,
        hashtags: ['apify', 'webscraping'],
        since: '2026-01-01T00:00:00.000Z',
        until: '2026-02-01T00:00:00.000Z',
        language: 'en',
        minLikes: 20,
        minRetweets: 10,
        minReplies: 5,
        onlyVerified: true,
        mediaType: 'images',
      }),
    ).toBe(true);
    expect(matchesFilters(tweet, { ...filters, hashtags: ['apify', 'missing'] })).toBe(false);
  });

  it('applies inclusive since and exclusive until boundaries', () => {
    expect(matchesFilters(tweet, { ...filters, since: tweet.createdAt })).toBe(true);
    expect(matchesFilters(tweet, { ...filters, until: tweet.createdAt })).toBe(false);
  });

  it('filters replies and retweets independently', () => {
    expect(
      matchesFilters({ ...tweet, isReply: true }, { ...filters, includeReplies: false }),
    ).toBe(false);
    expect(
      matchesFilters({ ...tweet, isRetweet: true }, { ...filters, includeRetweets: false }),
    ).toBe(false);
  });

  it('supports text, image, video, and link media filters', () => {
    expect(matchesFilters(tweet, { ...filters, mediaType: 'images' })).toBe(true);
    expect(matchesFilters(tweet, { ...filters, mediaType: 'links' })).toBe(true);
    expect(matchesFilters(tweet, { ...filters, mediaType: 'video' })).toBe(false);
    expect(matchesFilters(tweet, { ...filters, mediaType: 'text_only' })).toBe(false);

    const textOnly = { ...tweet, entities: { ...tweet.entities, media: [], urls: [] } };
    expect(matchesFilters(textOnly, { ...filters, mediaType: 'text_only' })).toBe(true);
  });

  it('rejects each unmet metric, language, and verification constraint', () => {
    expect(matchesFilters(tweet, { ...filters, language: 'fr' })).toBe(false);
    expect(matchesFilters(tweet, { ...filters, minLikes: 21 })).toBe(false);
    expect(matchesFilters(tweet, { ...filters, minRetweets: 11 })).toBe(false);
    expect(matchesFilters(tweet, { ...filters, minReplies: 6 })).toBe(false);
    expect(
      matchesFilters({ ...tweet, author: { ...tweet.author, verified: false } }, {
        ...filters,
        onlyVerified: true,
      }),
    ).toBe(false);
  });
});
