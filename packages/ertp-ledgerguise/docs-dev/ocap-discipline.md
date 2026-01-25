# Object-Capability (Ocap) Discipline

Guidelines for maintaining capability discipline in ertp-ledgerguise.

## Core Principles

1. **No ambient authority** - All capabilities must be explicitly passed
2. **Freeze API surfaces** - Objects that escape their creation context must be frozen
3. **Inject, don't import** - IO capabilities come from parameters, not imports

## Clock Injection

Timestamped rows (e.g., `post_date`, `enter_date`) must read from an injected clock capability, not ambient `Date.now()`.

```js
// Good: clock is injected
const kit = createIssuerKit({
  db,
  commodity,
  makeGuid,
  nowMs: () => Date.now(),  // Injected capability
});

// Testing: deterministic clock
const nowMs = makeTestClock(Date.UTC(2026, 0, 25), 1);
const kit = createIssuerKit({ db, commodity, makeGuid, nowMs });
```

This keeps tests deterministic and preserves ocap discipline.

## Database Injection

The database is passed as a capability, never opened from a path:

```js
// Good: db is injected
const kit = createIssuerKit({ db, ... });

// Bad: ambient filesystem access
const db = openDatabase('/path/to/file.gnucash');  // Don't do this
```

## Freezing API Surfaces

From the Jessie guidelines: any object literal, array literal, or function literal that escapes its creation context should be frozen.

```js
const { freeze } = Object;

// Good: freeze before returning
return freeze({
  escrowExchange,
  getSealedPurses: () => freeze({
    A: sealers.A.seal(escrows.A),
    B: sealers.B.seal(escrows.B),
  }),
});

// Only freeze values you create
// Don't freeze objects received from elsewhere
```

## Capability Attenuation

The sealer/unsealer pattern demonstrates capability attenuation:

- A `Purse` has full authority (deposit, withdraw, getBalance)
- A sealed purse token has no authority (it's inert)
- The `purses.getGuidFromSealed()` method provides read-only access to the GUID

This allows sharing identification without sharing authority.

## Zone Pattern

The `zone` parameter provides controlled object creation:

```js
const kit = createIssuerKit({
  db,
  commodity,
  makeGuid,
  nowMs,
  zone,  // Controls how objects are created (exo, etc.)
});
```

This enables future integration with durable storage or virtual objects.

## IBIS: Sync vs Async DB Access

**Issue:** Should the GnuCash-backed ERTP facade use synchronous or asynchronous DB access?

**Position A (sync):**
- Closer to ERTP's synchronous semantics (brand/purse/amount operations are typically sync)
- Easier to reason about atomicity in a single vat/turn
- Aligns with `better-sqlite3` and some WASM in-memory modes

**Position B (async):**
- Required in some environments (Cloudflare Workers/D1, OPFS-backed WASM)
- Matches vbank's pattern: sync bridge calls, async balance updates
- Avoids blocking the event loop in hosted environments

**Decision:** Start with synchronous DB access via injected capability.

**Consequences:**
- The `db` capability is sync (`better-sqlite3` style)
- Async environments would need a different adapter that pre-loads data or uses a different injection pattern
- Tests use in-memory sync adapters

This is not "async on top of sync"—rather, the injection point allows swapping the entire DB capability for environments with different constraints.

## See Also

- Jessie README: https://github.com/endojs/Jessie
- `sealer-unsealer.md` - Example of capability attenuation
- CONTRIBUTING.md - Agent tactics for maintaining ocap discipline
