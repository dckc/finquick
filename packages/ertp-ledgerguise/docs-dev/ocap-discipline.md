# Object-Capability (Ocap) Discipline

Guidelines for maintaining capability discipline in ertp-ledgerguise.

## Core Principles

1. **Inject, don't import** - IO capabilities come from parameters, not imports
   - This implies **no ambient authority**: all capabilities must be explicitly passed
2. **Encapsulation** - Objects protect their internal state and communicate by messages
   - **Freeze API surfaces** to enforce encapsulation at runtime

## Capability Injection

### Clock Injection

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

### Database Injection

The database is passed as a capability, never opened from a path:

```js
// Good: db is injected
const kit = createIssuerKit({ db, ... });

// Bad: ambient filesystem access
const db = openDatabase('/path/to/file.gnucash');  // Don't do this
```

See `escrow-accounting.md` for the sync vs async DB access decision.

## Encapsulation

### Freezing API Surfaces

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

### Zone Pattern

The `zone` parameter provides controlled object creation with built-in hardening:

```js
const kit = createIssuerKit({
  db,
  commodity,
  makeGuid,
  nowMs,
  zone,  // Controls how objects are created (exo, etc.)
});
```

`zone.exo()` creates frozen objects with method-only interfaces. This enables future integration with durable storage or virtual objects while enforcing encapsulation.

### Actors

An **actor** is an object with encapsulated state that communicates only by messages (method calls). In multi-party scenarios (like escrow), each participant should be modeled as an actor:

- Private purses owned by the actor, not leaked to callers
- Narrow interface exposed (e.g., `run()`, `getBalances()`)
- Communication via deposit facets, not direct purse access

This follows the Principle of Least Authority (POLA): give each object only the capabilities it needs. See `test/escrow-db.test.ts` for an example of actor encapsulation in tests.

### Closely Held vs Widely Shared

Capabilities fall into two categories based on how they're distributed:

| Category | Description | Examples |
|----------|-------------|----------|
| **Closely held** | Kept private within an actor; not shared | Purses, private keys, unsealer |
| **Widely shared** | Freely given to counterparties | Deposit facets, sealed tokens, brand |

A purse is closely held—only its owner can withdraw from it. But the purse's deposit facet is widely shared—anyone can deposit into it. This asymmetry enables safe cooperation: you can receive payments without risking your balance.

```js
const makeParty = ({ issuer, sealer }) => {
  // Closely held by the party
  const purse = issuer.makeEmptyPurse();

  return freeze({
    // Widely shared - safe to give to counterparties
    getDepositFacet: () => purse.getDepositFacet(),
    getSealedPurse: () => sealer.seal(purse),
    // Closely held - requires party's cooperation
    fund: (amount) => purse.withdraw(amount),
  });
};
```

## Increased Cooperation with Limited Vulnerability

> Capability-based security enables the concise composition of powerful patterns of cooperation without vulnerability.

The escrow pattern in `escrow-accounting.md` demonstrates this: two mutually distrusting parties can swap assets atomically. Each party funds the escrow with a `Promise<Payment>`, and settlement only occurs when both have funded. Neither party needs to trust the other—the escrow mechanism enforces the protocol.

A key pattern enabling this is **capability attenuation**: reducing the authority of an object before sharing it.

### Sealer/Unsealer Pattern

A sealer and unsealer work like public key cryptography conceptually. You give something to the sealer and it puts that into a box that only the corresponding unsealer can open.

```js
const { sealer, unsealer } = makeSealerUnsealerPair();

// Seal a powerful object into an inert token
const token = sealer.seal(purse);  // token has no authority

// Only the matching unsealer can retrieve the original
const original = unsealer.unseal(token);  // returns the purse
```

This allows sharing identification without sharing authority:

| What you have | Authority |
|---------------|-----------|
| Purse | Full: deposit, withdraw, getBalance |
| Sealed token | No methods |
| Unsealer | Can retrieve original to inspect it |

See `src/sealer.ts` for the implementation and `escrow-accounting.md` for how it's used to identify escrow accounts without leaking withdrawal authority.

## See Also

- Jessie README: https://github.com/endojs/Jessie
- `src/sealer.ts` - Sealer/unsealer implementation
- `escrow-accounting.md` - Escrow as cooperation without vulnerability
- `test/escrow-db.test.ts` - Actor encapsulation in tests
- CONTRIBUTING.md - Agent tactics for maintaining ocap discipline
