# Architecture

The Actor is intentionally a flat pipeline:

```text
Input
  ↓
Validation (input.ts)
  ↓
Entitlement (entitlement.ts)
  ↓
Scraper / cursor loop (scraper.ts)
  ↓
X guest HTTP/GraphQL (guest-token.ts, x-client.ts)
  ↓
Normalizer (normalizer.ts)
  ↓
Filters (filters.ts)
  ↓
Free-tier enforcement
  ↓
Default Apify Dataset
```

`main.ts` owns the Actor lifecycle, Apify Proxy, persisted migration state, final
`OUTPUT`, and dataset writes. `scraper.ts` processes tweet IDs and authors
sequentially, follows bottom cursors, detects cursor loops, deduplicates IDs, and
stops at the effective limit. X responses enter as `unknown`; `normalizer.ts`
validates required tweet/author fields and creates the complete output object.
Filters run on normalized tweets immediately before emission.

Entitlement is checked before any X request. `main.ts` passes the resulting paid
limit or FREE limit of 10 into the scraper and guards dataset emission at that same
limit. `STATE` stores pushed IDs, completed targets, and author cursors for migration.
