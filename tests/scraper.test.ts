import { describe, expect, it, vi } from 'vitest';

import { validateInput } from '../src/input.js';
import { TweetScraper } from '../src/scraper.js';
import type { RunStats, ScraperState, TweetOutput } from '../src/types.js';

function rawTweet(id: string): unknown {
  return {
    rest_id: id,
    core: {
      user_results: {
        result: {
          rest_id: '10',
          legacy: {
            screen_name: 'apify',
            name: 'Apify',
            followers_count: 1,
            friends_count: 1,
          },
        },
      },
    },
    legacy: {
      full_text: `tweet ${id}`,
      created_at: 'Wed Aug 19 12:00:00 +0000 2026',
      entities: {},
    },
  };
}

describe('TweetScraper', () => {
  it('paginates and deduplicates tweets across author pages', async () => {
    const getUserTweets = vi
      .fn()
      .mockResolvedValueOnce({
        tweets: [
          { tweet_results: { result: rawTweet('1') } },
          { tweet_results: { result: rawTweet('2') } },
        ],
        cursor: { cursorType: 'Bottom', value: 'next' },
      })
      .mockResolvedValueOnce({
        tweets: [
          { tweet_results: { result: rawTweet('2') } },
          { tweet_results: { result: rawTweet('3') } },
        ],
      });
    const scraper = new TweetScraper({
      getUserByScreenName: vi.fn().mockResolvedValue({
        data: { user: { result: { rest_id: '10', legacy: { screen_name: 'apify' } } } },
      }),
      getUserTweets,
      getTweetById: vi.fn(),
    });
    const emitted: TweetOutput[] = [];
    const state: ScraperState = {
      seenIds: new Set(),
      completedUsers: new Set(),
      completedTweetIds: new Set(),
      authorCursors: {},
    };
    const stats: RunStats = {
      requested: 10,
      fetched: 0,
      pushed: 0,
      limited: false,
      errors429: 0,
      errors403: 0,
      errors5xx: 0,
      fatalErrors: 0,
    };

    await scraper.run({
      input: validateInput({ fromUsers: ['apify'], maxResults: 10 }),
      limit: 10,
      state,
      stats,
      emit: async (tweet) => {
        emitted.push(tweet);
      },
    });

    expect(emitted.map((tweet) => tweet.id)).toEqual(['1', '2', '3']);
    expect(new Set(emitted.map((tweet) => tweet.id)).size).toBe(emitted.length);
    expect(getUserTweets).toHaveBeenCalledTimes(2);
    expect(state.completedUsers.has('apify')).toBe(true);
  });
});
