# Free-tier protection

```text
Apify runner userId
        ↓
protected KV-store record
        ↓
      PAID?
     /      \
   yes       no / error
    ↓             ↓
maxResults        min(maxResults, 10)
```

`main.ts` reads `userId` from `Actor.getEnv()`, never from Actor input.
`entitlement.ts` looks up that ID in the owner-controlled store configured by
`ENTITLEMENT_STORE_ID` and secret `ENTITLEMENT_STORE_TOKEN`. A record is paid only
when its value contains `{ "paid": true }`; missing records, unknown users,
configuration errors, timeouts, and lookup failures are FREE.

The effective limit is passed into pagination and checked again immediately before
the default dataset write. Input is parsed into an explicit shape, so fields such
as `paid`, `tier`, or `entitlement` have no effect. Thus a FREE input containing
`"maxResults": 1000` fetches and emits at most 10 valid unique items. The final
`OUTPUT` record exposes `limited`, `reason: "free_tier"`, and `cap: 10`.

## Fork boundary

The allow-list and access token are not stored in source or Actor input. A source
fork does not receive the original Actor's secret and therefore cannot query its
entitlement store; it fails closed to FREE. No source-level mechanism can stop a
fork owner from deleting their copy of the cap, but that fork cannot grant paid
access to, impersonate, or alter the entitlement of the original deployed Actor.
