# Agent context

## Project overview

`x-tweet-scraper` is a small TypeScript/Apify Actor that retrieves public X tweets by
author or tweet ID through guest HTTP/GraphQL calls and writes normalized records to
the default dataset.

## Important rules

- Use HTTP only. Never add Playwright, Puppeteer, Selenium, or browser automation.
- Keep TypeScript strict and the module structure flat.
- Never use personal X credentials, cookies, or sessions.
- Never bypass or weaken entitlement. FREE/unknown users receive at most 10 items.
- Entitlement is server-authoritative and fails closed.
- Do not silently enable unsupported functionality; `searchTerms` currently errors.
- Preserve the exact dataset output contract and never push raw X responses.
- Prefer direct, small modules over layers, factories, or dependency injection.

## Repository structure

- `src/main.ts`: Actor lifecycle, proxy, state, entitlement, dataset output, summary.
- `src/input.ts`: input defaults and validation.
- `src/x-client.ts`: bounded-retry X GraphQL requests.
- `src/guest-token.ts`: concurrent-safe guest-token activation and rotation.
- `src/scraper.ts`: targets, cursor pagination, stopping, and deduplication.
- `src/filters.ts`: pure AND-based filters.
- `src/normalizer.ts`: untyped X boundary parsing into the exact output schema.
- `src/entitlement.ts`: protected-store lookup and effective result limit.
- `src/utils.ts`: narrow parsing, timestamp, retry, and error helpers.

## Development workflow

```sh
npm install
npm test
npm run typecheck
npm run build
APIFY_LOCAL_STORAGE_DIR=./storage npm run start:dev
```

Place Actor input in `storage/key_value_stores/default/INPUT.json` for a local run.

## Important decisions

See [architecture](docs/architecture.md), [X integration](docs/x-api.md),
[free-tier protection](docs/free-tier.md), and [development](docs/development.md).

## Agent guidelines

- Inspect current code before editing; prefer focused changes.
- Preserve output and entitlement contracts and update tests when behavior changes.
- Do not add abstractions unless a concrete requirement needs them.
- Update relevant Markdown and tests when architecture, X integration, entitlement,
  output schema, scraper behavior, or retry behavior changes. Do not update docs for
  trivial implementation-only changes.
