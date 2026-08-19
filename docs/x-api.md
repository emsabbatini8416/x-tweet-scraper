# X integration

The Actor uses browserless HTTPS requests to X's public web GraphQL surface. It
does not use an account, cookies, a personal session, or browser automation.

## Request lifecycle

1. `guest-token.ts` activates a guest token with `POST /1.1/guest/activate.json`,
   caches it for 30 minutes, and coalesces concurrent activation.
2. `x-client.ts` sends the application bearer and guest token to
   `https://x.com/i/api/graphql/{queryId}/{operation}`.
3. A 403 invalidates the guest token; retryable responses use bounded backoff.
4. `normalizer.ts` parses the response from an `unknown` boundary.

Implemented operations and current fallback query IDs:

- `UserByScreenName`: `xc8f1g7BYqr6VTzTbvNlGw`
- `UserTweets`: `V7H0Ap3_Hh2FyS75OCDO3Q`
- `TweetResultByRestId`: `V3vfsYzNEyD9tsf4xoFRgw`

X's internal operations are undocumented and query IDs rotate. The three
`X_*_QUERY_ID` environment variables override these fallbacks without a code
change. Never put bearer or guest tokens in documentation or logs.

`UserByScreenName` resolves profile/author identity; `UserTweets` returns recent
author timeline pages and bottom cursors; `TweetResultByRestId` hydrates a tweet.
The scraper stops on the result limit, no cursor, an old-date page, or a cursor
loop. Promoted entries and response records that cannot satisfy the output schema
are ignored.

## Limitations

- This is an internal web API, not a stable supported X API; feature flags, response
  shapes, anti-bot rules, or operation IDs can change.
- `searchTerms` is validated but rejected clearly because reliable public search
  currently requires an authenticated session. It never silently returns zero.
- `sortBy: "top"` ranks each fetched recent timeline page; it is not a global X
  relevance search.
- Protected, deleted, withheld, or tombstoned content cannot be normalized.
