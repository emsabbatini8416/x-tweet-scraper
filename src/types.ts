export type MediaTypeFilter = 'any' | 'text_only' | 'images' | 'video' | 'links';
export type SortOrder = 'latest' | 'top';

export interface ActorInput {
  fromUsers?: string[];
  tweetIds?: string[];
  searchTerms?: string[];
  hashtags?: string[];
  since?: string;
  until?: string;
  language?: string;
  minLikes?: number;
  minRetweets?: number;
  minReplies?: number;
  onlyVerified?: boolean;
  mediaType?: MediaTypeFilter;
  includeReplies?: boolean;
  includeRetweets?: boolean;
  sortBy?: SortOrder;
  maxResults?: number;
  proxyConfiguration?: Record<string, unknown>;
}

export interface ValidatedInput {
  fromUsers: string[];
  tweetIds: string[];
  searchTerms: string[];
  hashtags: string[];
  since: string | null;
  until: string | null;
  language: string | null;
  minLikes: number | null;
  minRetweets: number | null;
  minReplies: number | null;
  onlyVerified: boolean;
  mediaType: MediaTypeFilter;
  includeReplies: boolean;
  includeRetweets: boolean;
  sortBy: SortOrder;
  maxResults: number;
  proxyConfiguration: Record<string, unknown> | null;
}

export interface TweetMedia {
  type: 'photo' | 'video' | 'animated_gif';
  url: string;
  thumbnail: string | null;
}

export interface TweetOutput {
  id: string;
  url: string;
  text: string;
  lang: string | null;
  createdAt: string;
  conversationId: string | null;
  isReply: boolean;
  isRetweet: boolean;
  isQuote: boolean;
  inReplyToId: string | null;
  quotedTweetId: string | null;
  author: {
    id: string;
    username: string;
    name: string;
    verified: boolean;
    followers: number;
    following: number;
  };
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    bookmarks: number | null;
    views: number | null;
  };
  entities: {
    hashtags: string[];
    mentions: string[];
    urls: string[];
    media: TweetMedia[];
  };
  source: string | null;
  scrapedAt: string;
}

export interface Entitlement {
  paid: boolean;
  status: 'paid' | 'free' | 'unknown';
  source: 'store' | 'default';
}

export interface RunLimits {
  requested: number;
  effective: number;
  limited: boolean;
  reason: 'free_tier' | null;
  cap: number | null;
}

export interface RunStats {
  requested: number;
  fetched: number;
  pushed: number;
  limited: boolean;
  errors429: number;
  errors403: number;
  errors5xx: number;
  fatalErrors: number;
}

export interface PersistedState {
  seenIds: string[];
  completedUsers: string[];
  completedTweetIds: string[];
  authorCursors: Record<string, string | null>;
}

export interface ScraperState {
  seenIds: Set<string>;
  completedUsers: Set<string>;
  completedTweetIds: Set<string>;
  authorCursors: Record<string, string | null>;
}

export interface ScrapeOptions {
  input: ValidatedInput;
  limit: number;
  state: ScraperState;
  stats: RunStats;
  emit: (tweet: TweetOutput) => Promise<void>;
}

export interface XClientErrorContext {
  statusCode: number | null;
  retryable: boolean;
}
