import { Actor, log } from 'apify';

import { calculateRunLimits, resolveEntitlement } from './entitlement.js';
import { validateInput } from './input.js';
import { TweetScraper } from './scraper.js';
import type {
  ActorInput,
  PersistedState,
  RunStats,
  ScraperState,
  TweetOutput,
} from './types.js';
import { XClient } from './x-client.js';

const EMPTY_STATE: PersistedState = {
  seenIds: [],
  completedUsers: [],
  completedTweetIds: [],
  authorCursors: {},
};

function hydrateState(persisted: PersistedState): ScraperState {
  return {
    seenIds: new Set(persisted.seenIds),
    completedUsers: new Set(persisted.completedUsers),
    completedTweetIds: new Set(persisted.completedTweetIds),
    authorCursors: persisted.authorCursors,
  };
}

function serializeState(state: ScraperState): PersistedState {
  return {
    seenIds: [...state.seenIds],
    completedUsers: [...state.completedUsers],
    completedTweetIds: [...state.completedTweetIds],
    authorCursors: state.authorCursors,
  };
}

await Actor.init();

try {
  const input = validateInput(await Actor.getInput<ActorInput>());
  const stats: RunStats = {
    requested: input.maxResults,
    fetched: 0,
    pushed: 0,
    limited: false,
    errors429: 0,
    errors403: 0,
    errors5xx: 0,
    fatalErrors: 0,
  };
  const env = Actor.getEnv();
  const entitlement = await resolveEntitlement({
    userId: env.userId,
    ...(process.env.ENTITLEMENT_STORE_ID
      ? { storeId: process.env.ENTITLEMENT_STORE_ID }
      : {}),
    ...(process.env.ENTITLEMENT_STORE_TOKEN
      ? { storeToken: process.env.ENTITLEMENT_STORE_TOKEN }
      : {}),
  });
  const limits = calculateRunLimits(input.maxResults, entitlement);
  stats.limited = limits.limited;

  const bearerToken = process.env.X_BEARER_TOKEN;
  if (!bearerToken) throw new Error('X_BEARER_TOKEN is required');

  const proxyConfiguration =
    input.proxyConfiguration === null
      ? undefined
      : await Actor.createProxyConfiguration(input.proxyConfiguration);
  const persisted = (await Actor.getValue<PersistedState>('STATE')) ?? EMPTY_STATE;
  const state = hydrateState(persisted);
  stats.pushed = state.seenIds.size;

  const persistState = async (): Promise<void> => {
    await Actor.setValue('STATE', serializeState(state));
  };
  Actor.on('migrating', persistState);

  const client = new XClient({
    bearerToken,
    getProxyUrl: async () => proxyConfiguration?.newUrl(),
    stats,
    queryIds: {
      ...(process.env.X_USER_BY_SCREEN_NAME_QUERY_ID
        ? { userByScreenName: process.env.X_USER_BY_SCREEN_NAME_QUERY_ID }
        : {}),
      ...(process.env.X_USER_TWEETS_QUERY_ID
        ? { userTweets: process.env.X_USER_TWEETS_QUERY_ID }
        : {}),
      ...(process.env.X_TWEET_BY_ID_QUERY_ID
        ? { tweetById: process.env.X_TWEET_BY_ID_QUERY_ID }
        : {}),
    },
  });
  const scraper = new TweetScraper(client);

  log.info('Scrape started', {
    requested: stats.requested,
    effectiveLimit: limits.effective,
    entitlement: entitlement.status,
    authors: input.fromUsers.length,
    tweetIds: input.tweetIds.length,
  });

  await scraper.run({
    input,
    limit: limits.effective,
    state,
    stats,
    emit: async (tweet: TweetOutput) => {
      if (stats.pushed >= limits.effective) {
        throw new Error('Result limit reached');
      }
      await Actor.pushData(tweet);
    },
  });

  await persistState();
  await Actor.setValue('OUTPUT', {
    limited: limits.limited,
    reason: limits.reason,
    cap: limits.cap,
    stats,
  });
  log.info('Scrape finished', stats);
} finally {
  await Actor.exit();
}
