# x-tweet-scraper

A small Apify SDK v3 Actor that retrieves public X tweets by author or tweet ID
using HTTP/GraphQL only. It writes normalized, deduplicated records to the default
Apify dataset and does not use a browser or personal X account.

## Features

- Recent author timelines with cursor pagination
- Tweet hydration by numeric ID and complete author profile fields
- Date, language, engagement, verification, media, reply, retweet, and hashtag filters
- Exact stable output schema with string IDs, UTC timestamps, nulls, and no `undefined`
- Apify Proxy, migration state, bounded retries, structured counters, and deduplication
- Server-authoritative FREE cap of 10; PAID runs use `maxResults`

The flow is input validation → entitlement → X guest HTTP → normalization →
filtering → capped dataset emission. See [architecture](docs/architecture.md).

## Setup and local run

Requires Node.js 20+.

```sh
npm install
cp .env.example .env
npm test
npm run typecheck
npm run build
```

Set `X_BEARER_TOKEN`, then write this to
`storage/key_value_stores/default/INPUT.json`:

```json
{ "fromUsers": ["apify"], "maxResults": 5 }
```

Run with exported `.env` values:

```sh
APIFY_LOCAL_STORAGE_DIR=./storage npm run start:dev
```

Another supported input is `{ "tweetIds": ["123456789"] }`. At least one of
`fromUsers`, `tweetIds`, or `searchTerms` is required. Unspecified optional
filters impose no constraint. `includeReplies` and `includeRetweets` default to
`false`. `since` / `until` are an inclusive creation window; a date-only value
covers that whole UTC day. Active filters use AND semantics. Tweet `text` is
HTML-unescaped with `t.co` links replaced by expanded URLs. Standard
`proxyConfiguration`, including Apify Proxy groups, is passed to all X requests.

## X surfaces and limitations

Implemented internal web operations are `UserByScreenName`, `UserTweets`, and
`TweetResultByRestId`. `searchTerms` is intentionally rejected with a clear error:
reliable public search currently requires an authenticated session, which this
Actor will not use. X's GraphQL API is undocumented and operation IDs, feature
flags, response shapes, guest access, and rate limits may change. Environment
overrides allow operation-ID updates; details are in [X API](docs/x-api.md).

`sortBy: "latest"` follows timeline order. `"top"` ranks each fetched recent page,
not X's global relevance index. Protected, deleted, withheld, or malformed tweets
may be unavailable.

## Free tier and resilience

The runner `userId` comes from Apify's server environment. A protected KV store,
accessed with deployment-only secrets, is authoritative; missing users or any
lookup failure are FREE. The cap is enforced during fetching and dataset emission,
so FREE plus `maxResults: 1000` still emits at most 10. Input cannot select a tier.
See [free-tier design](docs/free-tier.md).

429, 403, 5xx, timeouts, and transient network failures use bounded exponential
backoff with jitter. A 403 rotates the guest token, and one failed target does not
abort unrelated targets. Final counters are logged and saved in the default
KV-store `OUTPUT` record.

## Deployment, Docker, and measurement

```sh
docker build -t x-tweet-scraper .
```

Create an Apify Actor from this Dockerfile, attach `INPUT_SCHEMA.json`, configure
the environment secrets below, build, and run a small input. With an Apify CLI
project connected to that Actor, deploy with `apify push`.

**Actor URL (paste after deploy):** `https://console.apify.com/actors/<ACTOR_ID>`

Time-to-100 protocol (paid runner, residential proxy, high-volume author):

```json
{
  "fromUsers": ["<high-volume-handle>"],
  "sortBy": "latest",
  "maxResults": 100,
  "includeReplies": false,
  "includeRetweets": false,
  "proxyConfiguration": { "useApifyProxy": true, "apifyProxyGroups": ["RESIDENTIAL"] }
}
```

Start the timer at the first outbound X request and stop when the 100th schema
item is pushed. Exclude cold-start and build. Record wall-clock here after that
run: **unmeasured in this checkout** (needs a paid Apify run against a live
target). Re-run locally with `/usr/bin/time -p` only as a sanity check; it is not
the grading clock.

Required deployment values:

- `X_BEARER_TOKEN`
- `ENTITLEMENT_STORE_ID`
- `ENTITLEMENT_STORE_TOKEN`

Optional query-ID overrides are listed in `.env.example`.

## X terms and responsible use

Use this Actor only for public data and in compliance with X's Terms, applicable
law, privacy obligations, and Apify policies. Minimize collection, respect rate
limits, and do not use the project to access protected content or evade access
controls.

Developer commands and Docker details are in [development](docs/development.md).
