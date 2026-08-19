# Testing

Run `npm test`, then `npm run typecheck` and `npm run build`.

- `filters.test.ts` covers each required filter, boundaries, media, and AND logic.
- `normalizer.test.ts` verifies the exact nested schema, string IDs, UTC timestamps,
  nulls, author, metrics, entities, and media selection.
- `entitlement.test.ts` must always prove: FREE 5 → 5, FREE 1000 → 10, PAID 100 →
  100, lookup failure → FREE, unknown user → FREE, and input cannot elevate access.
- `scraper.test.ts` covers cursor pagination and cross-page deduplication.

Update tests whenever filter semantics, raw response parsing, output fields, or
entitlement behavior changes. Prefer small fixtures and pure-unit coverage; add
scraper tests only for meaningful pagination/deduplication regressions. Do not make
live X access part of the deterministic unit suite.
