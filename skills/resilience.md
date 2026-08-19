# Retry and resilience rules

`x-client.ts` owns GraphQL retries; `guest-token.ts` owns activation retries. Both
use bounded exponential backoff with up to 25% jitter and request timeouts.

- Retry 429, 5xx, 403 after guest-token invalidation, and transient network errors.
- Retry a GraphQL request at most four attempts; activation at most three.
- Do not retry malformed JSON, a GraphQL error without data, or other fatal input/
  response errors.
- A failed target is logged and counted, then the scraper continues with other
  tweet IDs/authors.
- Never retry forever or log authorization/guest tokens.

Keep `errors429`, `errors403`, `errors5xx`, and `fatalErrors` counters accurate.
If status handling, attempts, delay, or timeout changes, update tests where useful
and update `docs/x-api.md`.
