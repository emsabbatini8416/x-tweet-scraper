# Development

## Local setup

Requires Node.js 20+ and Docker for container verification.

```sh
npm install
cp .env.example .env
npm test
npm run typecheck
npm run build
```

`X_BEARER_TOKEN` is required. The entitlement store ID/token are deployment
secrets; without them the run intentionally receives the FREE cap. Query-ID
overrides are optional and are needed only when X rotates an operation.

For a local scrape, create
`storage/key_value_stores/default/INPUT.json`:

```json
{ "fromUsers": ["apify"], "maxResults": 5 }
```

Export values from `.env`, then run:

```sh
APIFY_LOCAL_STORAGE_DIR=./storage npm run start:dev
```

Results are under `storage/datasets/default/`; the run summary is the default
KV-store `OUTPUT` record. Use `/usr/bin/time -p` before the same command to run a
small performance measurement. Record the input, proxy, result count, and network
conditions with any reported number; this repository does not claim a benchmark.

## Docker and deployment

```sh
docker build -t x-tweet-scraper .
docker run --rm -e X_BEARER_TOKEN -v "$PWD/storage:/usr/src/app/storage" \
  x-tweet-scraper
```

On Apify, create an Actor from this source/Dockerfile, map `INPUT_SCHEMA.json` as
its input schema, add `X_BEARER_TOKEN`, `ENTITLEMENT_STORE_ID`, and
`ENTITLEMENT_STORE_TOKEN` as secrets, build, and run a small input. With Apify CLI
configured for the Actor, `apify push` performs the source upload/build.
