import { log } from 'apify';

import { matchesFilters } from './filters.js';
import { extractBottomCursor, extractTweets, extractUserId } from './normalizer.js';
import type { ScrapeOptions, TweetOutput } from './types.js';
import { serializeError } from './utils.js';
import { XClient } from './x-client.js';

type XApi = Pick<XClient, 'getUserByScreenName' | 'getUserTweets' | 'getTweetById'>;

export class TweetScraper {
  public constructor(private readonly client: XApi) {}

  public async run(options: ScrapeOptions): Promise<void> {
    for (const tweetId of options.input.tweetIds) {
      if (options.stats.pushed >= options.limit) return;
      if (options.state.completedTweetIds.has(tweetId)) continue;
      if (await this.scrapeTweet(tweetId, options)) {
        options.state.completedTweetIds.add(tweetId);
      }
    }

    for (const username of options.input.fromUsers) {
      if (options.stats.pushed >= options.limit) return;
      if (options.state.completedUsers.has(username)) continue;
      await this.scrapeAuthor(username, options);
    }
  }

  private async scrapeTweet(tweetId: string, options: ScrapeOptions): Promise<boolean> {
    try {
      const payload = await this.client.getTweetById(tweetId);
      const tweets = extractTweets(payload);
      options.stats.fetched += tweets.length;
      const target = tweets.find((tweet) => tweet.id === tweetId);
      if (target !== undefined) await this.emitIfValid(target, options);
      return true;
    } catch (error) {
      options.stats.fatalErrors += 1;
      log.warning('Tweet target failed', { tweetId, error: serializeError(error) });
      return false;
    }
  }

  private async scrapeAuthor(username: string, options: ScrapeOptions): Promise<void> {
    try {
      const profile = await this.client.getUserByScreenName(username);
      const userId = extractUserId(profile);
      if (userId === null) {
        throw new Error(`X user @${username} was not found or returned no public profile`);
      }

      let cursor = options.state.authorCursors[username] ?? null;
      const cursors = new Set<string>();
      if (cursor !== null) cursors.add(cursor);

      while (options.stats.pushed < options.limit) {
        const remaining = options.limit - options.stats.pushed;
        const payload = await this.client.getUserTweets(userId, Math.min(100, remaining * 2), cursor);
        let tweets = extractTweets(payload);
        options.stats.fetched += tweets.length;

        if (options.input.sortBy === 'top') {
          tweets = tweets.sort(
            (a, b) =>
              b.metrics.likes +
              b.metrics.retweets +
              b.metrics.replies -
              (a.metrics.likes + a.metrics.retweets + a.metrics.replies),
          );
        }

        for (const tweet of tweets) {
          if (options.stats.pushed >= options.limit) break;
          await this.emitIfValid(tweet, options);
        }

        const nextCursor = extractBottomCursor(payload);
        options.state.authorCursors[username] = nextCursor;
        const pageEntirelyBeforeSince =
          options.input.since !== null &&
          tweets.length > 0 &&
          tweets.every((tweet) => tweet.createdAt < options.input.since!);
        if (
          nextCursor === null ||
          cursors.has(nextCursor) ||
          pageEntirelyBeforeSince ||
          options.stats.pushed >= options.limit
        ) {
          options.state.completedUsers.add(username);
          return;
        }
        cursors.add(nextCursor);
        cursor = nextCursor;
      }
    } catch (error) {
      options.stats.fatalErrors += 1;
      log.warning('Author target failed', { username, error: serializeError(error) });
    }
  }

  private async emitIfValid(tweet: TweetOutput, options: ScrapeOptions): Promise<void> {
    if (options.state.seenIds.has(tweet.id) || !matchesFilters(tweet, options.input)) return;
    await options.emit(tweet);
    options.state.seenIds.add(tweet.id);
    options.stats.pushed += 1;
  }
}
