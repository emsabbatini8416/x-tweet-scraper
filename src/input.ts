import type { ActorInput, MediaTypeFilter, SortOrder, ValidatedInput } from './types.js';

const MEDIA_TYPES = new Set<MediaTypeFilter>(['any', 'text_only', 'images', 'video', 'links']);
const SORT_ORDERS = new Set<SortOrder>(['latest', 'top']);

function stringList(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${field} must be an array of strings`);
  }
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function optionalWindowBound(
  value: unknown,
  field: string,
  bound: 'start' | 'end',
): string | null {
  if (value === undefined || value === '') return null;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} must be a valid ISO-8601 date or timestamp`);
  }
  if (DATE_ONLY.test(value)) {
    return bound === 'start' ? `${value}T00:00:00.000Z` : `${value}T23:59:59.999Z`;
  }
  return new Date(value).toISOString();
}

function optionalNonNegativeInteger(value: unknown, field: string): number | null {
  if (value === undefined) return null;
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
  return value as number;
}

export function validateInput(raw: ActorInput | null | undefined): ValidatedInput {
  const input = raw ?? {};
  const fromUsers = stringList(input.fromUsers, 'fromUsers').map((value) =>
    value.replace(/^@/, '').toLowerCase(),
  );
  const tweetIds = stringList(input.tweetIds, 'tweetIds');
  const searchTerms = stringList(input.searchTerms, 'searchTerms');
  const hashtags = stringList(input.hashtags, 'hashtags').map((value) =>
    value.replace(/^#/, '').toLowerCase(),
  );

  if (fromUsers.length + tweetIds.length + searchTerms.length === 0) {
    throw new Error('Provide at least one of fromUsers, tweetIds, or searchTerms');
  }
  if (fromUsers.some((value) => !/^[a-z0-9_]{1,15}$/i.test(value))) {
    throw new Error('fromUsers contains an invalid X username');
  }
  if (tweetIds.some((value) => !/^\d+$/.test(value))) {
    throw new Error('tweetIds must contain numeric tweet IDs');
  }
  if (searchTerms.length > 0) {
    throw new Error(
      'searchTerms is not supported: public X search currently requires an authenticated session',
    );
  }

  const since = optionalWindowBound(input.since, 'since', 'start');
  const until = optionalWindowBound(input.until, 'until', 'end');
  if (since !== null && until !== null && since > until) {
    throw new Error('since must be earlier than or equal to until');
  }

  const mediaType = input.mediaType ?? 'any';
  if (!MEDIA_TYPES.has(mediaType)) throw new Error('mediaType is invalid');
  const sortBy = input.sortBy ?? 'latest';
  if (!SORT_ORDERS.has(sortBy)) throw new Error('sortBy is invalid');

  const maxResults = input.maxResults ?? 100;
  if (!Number.isSafeInteger(maxResults) || maxResults < 1) {
    throw new Error('maxResults must be a positive integer');
  }

  return {
    fromUsers: [...new Set(fromUsers)],
    tweetIds: [...new Set(tweetIds)],
    searchTerms,
    hashtags,
    since,
    until,
    language: input.language?.trim().toLowerCase() || null,
    minLikes: optionalNonNegativeInteger(input.minLikes, 'minLikes'),
    minRetweets: optionalNonNegativeInteger(input.minRetweets, 'minRetweets'),
    minReplies: optionalNonNegativeInteger(input.minReplies, 'minReplies'),
    onlyVerified: input.onlyVerified ?? false,
    mediaType,
    includeReplies: input.includeReplies ?? false,
    includeRetweets: input.includeRetweets ?? false,
    sortBy,
    maxResults,
    proxyConfiguration: input.proxyConfiguration ?? null,
  };
}
