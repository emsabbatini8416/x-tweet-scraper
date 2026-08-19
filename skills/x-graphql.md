# Working with X GraphQL

All X access is HTTP-only in `guest-token.ts` and `x-client.ts`. Guest activation
uses the configured application bearer, caches the returned guest token, coalesces
concurrent refreshes, and invalidates it after 403.

The client sends JSON-encoded `variables` and feature flags to:

```text
https://x.com/i/api/graphql/{queryId}/{operationName}
```

Operations are `UserByScreenName`, `UserTweets`, and `TweetResultByRestId`. Their
fallback query IDs are in `x-client.ts` and environment overrides exist because
these internal IDs rotate. Update `docs/x-api.md` when an ID, feature set, request,
or parsed response shape changes.

Responses must remain `unknown` until parsed by `normalizer.ts`. Treat malformed
JSON/GraphQL errors as failures, refresh guest tokens on 403, and never add cookies,
personal sessions, credentials, or token logging.
