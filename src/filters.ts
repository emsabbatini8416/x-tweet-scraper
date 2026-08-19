import type { TweetOutput, ValidatedInput } from './types.js';

export type TweetFilters = Pick<
  ValidatedInput,
  | 'hashtags'
  | 'since'
  | 'until'
  | 'language'
  | 'minLikes'
  | 'minRetweets'
  | 'minReplies'
  | 'onlyVerified'
  | 'mediaType'
  | 'includeReplies'
  | 'includeRetweets'
>;

export function matchesFilters(tweet: TweetOutput, filters: TweetFilters): boolean {
  const hashtagSet = new Set(tweet.entities.hashtags.map((tag) => tag.toLowerCase()));
  if (!filters.hashtags.every((tag) => hashtagSet.has(tag.toLowerCase()))) return false;
  if (filters.since !== null && tweet.createdAt < filters.since) return false;
  if (filters.until !== null && tweet.createdAt > filters.until) return false;
  if (filters.language !== null && tweet.lang?.toLowerCase() !== filters.language) return false;
  if (filters.minLikes !== null && tweet.metrics.likes < filters.minLikes) return false;
  if (filters.minRetweets !== null && tweet.metrics.retweets < filters.minRetweets) return false;
  if (filters.minReplies !== null && tweet.metrics.replies < filters.minReplies) return false;
  if (filters.onlyVerified && !tweet.author.verified) return false;
  if (!filters.includeReplies && tweet.isReply) return false;
  if (!filters.includeRetweets && tweet.isRetweet) return false;

  const hasImages = tweet.entities.media.some((media) => media.type === 'photo');
  const hasVideo = tweet.entities.media.some(
    (media) => media.type === 'video' || media.type === 'animated_gif',
  );
  if (filters.mediaType === 'text_only' && (tweet.entities.media.length > 0 || tweet.entities.urls.length > 0)) {
    return false;
  }
  if (filters.mediaType === 'images' && !hasImages) return false;
  if (filters.mediaType === 'video' && !hasVideo) return false;
  if (filters.mediaType === 'links' && tweet.entities.urls.length === 0) return false;

  return true;
}
