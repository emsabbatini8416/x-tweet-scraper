import { gotScraping } from 'got-scraping';

import { GuestTokenManager } from './guest-token.js';
import type { RunStats } from './types.js';
import { asRecord, delayWithJitter, serializeError } from './utils.js';

interface QueryIds {
  userByScreenName: string;
  userTweets: string;
  tweetById: string;
}

const DEFAULT_QUERY_IDS: QueryIds = {
  userByScreenName: 'xc8f1g7BYqr6VTzTbvNlGw',
  userTweets: 'V7H0Ap3_Hh2FyS75OCDO3Q',
  tweetById: 'V3vfsYzNEyD9tsf4xoFRgw',
} as const;

const FEATURES = {
  creator_subscriptions_tweet_preview_api_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_enhance_cards_enabled: false,
  responsive_web_graphql_exclude_directive_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_media_download_video_enabled: false,
  rweb_video_screen_enabled: false,
  standardized_nudges_misinfo: false,
  tweet_awards_web_tipping_enabled: false,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  verified_phone_label_enabled: false,
} as const;

export class XClientError extends Error {
  public constructor(
    message: string,
    public readonly statusCode: number | null,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'XClientError';
  }
}

export interface XClientOptions {
  bearerToken: string;
  getProxyUrl: () => Promise<string | undefined>;
  stats: RunStats;
  queryIds?: Partial<QueryIds>;
}

export class XClient {
  private readonly guestTokens: GuestTokenManager;
  private readonly queryIds: QueryIds;

  public constructor(private readonly options: XClientOptions) {
    this.guestTokens = new GuestTokenManager(
      options.bearerToken,
      options.getProxyUrl,
      (statusCode) => this.trackStatus(statusCode),
    );
    this.queryIds = { ...DEFAULT_QUERY_IDS, ...options.queryIds };
  }

  public getUserByScreenName(username: string): Promise<unknown> {
    return this.graphql(this.queryIds.userByScreenName, 'UserByScreenName', {
      screen_name: username,
      withSafetyModeUserFields: true,
    });
  }

  public getUserTweets(userId: string, count: number, cursor: string | null): Promise<unknown> {
    const variables: Record<string, unknown> = {
      userId,
      count: Math.min(100, Math.max(20, count)),
      includePromotedContent: false,
      withQuickPromoteEligibilityTweetFields: false,
      withVoice: true,
      withV2Timeline: true,
    };
    if (cursor !== null) variables.cursor = cursor;
    return this.graphql(this.queryIds.userTweets, 'UserTweets', variables);
  }

  public getTweetById(tweetId: string): Promise<unknown> {
    return this.graphql(this.queryIds.tweetById, 'TweetResultByRestId', {
      tweetId,
      withCommunity: false,
      includePromotedContent: false,
      withVoice: true,
    });
  }

  private async graphql(
    queryId: string,
    operationName: string,
    variables: Record<string, unknown>,
  ): Promise<unknown> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const guestToken = await this.guestTokens.get();
      try {
        const proxyUrl = await this.options.getProxyUrl();
        const response = await gotScraping(
          `https://x.com/i/api/graphql/${queryId}/${operationName}`,
          {
            searchParams: {
              variables: JSON.stringify(variables),
              features: JSON.stringify(FEATURES),
            },
            headers: {
              authorization: `Bearer ${this.options.bearerToken}`,
              'x-guest-token': guestToken,
              'x-twitter-active-user': 'yes',
              'x-twitter-client-language': 'en',
            },
            ...(proxyUrl === undefined ? {} : { proxyUrl }),
            timeout: { request: 20_000 },
            retry: { limit: 0 },
            throwHttpErrors: false,
          },
        );

        this.trackStatus(response.statusCode);
        if (response.statusCode === 200) {
          const parsed: unknown = JSON.parse(response.body);
          const record = asRecord(parsed);
          if (record === null) throw new XClientError('X returned invalid JSON', 200, false);
          if (Array.isArray(record.errors) && record.data === undefined) {
            throw new XClientError('X GraphQL returned an error response', 200, false);
          }
          return parsed;
        }

        const retryable =
          response.statusCode === 403 ||
          response.statusCode === 429 ||
          response.statusCode >= 500;
        if (response.statusCode === 403) this.guestTokens.invalidate(guestToken);
        throw new XClientError(
          `X ${operationName} returned HTTP ${response.statusCode}`,
          response.statusCode,
          retryable,
        );
      } catch (error) {
        lastError = error;
        const retryable =
          error instanceof XClientError
            ? error.retryable
            : !(error instanceof SyntaxError);
        if (!retryable || attempt === 3) break;
        await delayWithJitter(attempt);
      }
    }

    if (lastError instanceof XClientError) throw lastError;
    throw new XClientError(
      `X request failed: ${serializeError(lastError)}`,
      null,
      false,
    );
  }

  private trackStatus(statusCode: number): void {
    if (statusCode === 429) this.options.stats.errors429 += 1;
    if (statusCode === 403) this.options.stats.errors403 += 1;
    if (statusCode >= 500) this.options.stats.errors5xx += 1;
  }
}
