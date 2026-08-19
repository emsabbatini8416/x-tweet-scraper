# Safely changing the scraper

Scraping orchestration and pagination live in `src/scraper.ts`. Author targets
first resolve `UserByScreenName`, then call `UserTweets` until enough valid items,
no bottom cursor, an old-date page, or a repeated cursor. Tweet-ID targets call
`TweetResultByRestId`. Targets run sequentially for controlled concurrency.

Normalization occurs before filtering. Filters use AND semantics. `state.seenIds`
contains emitted IDs and deduplicates pages, authors, tweet IDs, and overlaps.
The effective entitlement limit, not raw input `maxResults`, controls stopping and
emission. Migration state preserves cursors and completed targets.

DO:
- reuse `x-client.ts`
- preserve bottom-cursor loop detection and deduplication
- stop fetching and pushing when the effective target is reached
- keep unsupported/tombstoned entries non-fatal

DON'T:
- add browser automation or personal X sessions
- bypass entitlement or use input as entitlement
- push raw X responses to the dataset
- use unbounded `Promise.all`
