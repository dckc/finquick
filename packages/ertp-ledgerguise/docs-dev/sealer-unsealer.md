# Sealer/Unsealer Pattern

Secure identification of escrow accounts without leaking withdrawal authority.

## Problem

To implement the atomic swap accounting model, we need to identify the account GUIDs of the internal escrow purses (the ones created by `makeErtpEscrow`) in a secure, object-capability (ocap) compliant manner.

We cannot simply return the `Purse` objects themselves, as this would leak the authority to withdraw funds, violating security principles.

## Solution

The solution leverages a "sealer/unsealer" pattern using a shared `WeakMap`:

### 1. `createIssuerKit` Enhancements

- Internally, `createIssuerKit` creates a private `sealer` and `unsealer` pair that shares a secret `WeakMap`.
- The `sealer` can turn a powerful object (like a `Purse`) into an inert, unforgeable "token" (a sealed object).
- The `unsealer` can later retrieve the original object from its corresponding token.
- The `issuerKit` returns the `sealer` object at its top level, allowing authorized parties to create sealed tokens.
- The existing `purses` facet is enhanced with a new method: `getGuidFromSealed(sealedPurse)`. This `purses` facet acts as the "unsealer".

### 2. `makeErtpEscrow` Integration

- The `makeErtpEscrow` function accepts the `sealer` object (obtained from an `issuerKit`) as a parameter.
- After creating its internal escrow purses, `makeErtpEscrow` uses this provided `sealer` to create inert, sealed tokens for these internal purses.
- `makeErtpEscrow` provides a new method, `getSealedPurses()`, which safely returns these `sealedPurse` tokens.

### 3. Client-Side Orchestration

```js
// 1. Create issuerKits, obtaining sealer and purses facet
const moolaKit = createIssuerKit({ db, ... });
const stockKit = createIssuerKit({ db, ... });

// 2. Create escrow instance, passing sealers
const escrow = makeErtpEscrow({
  issuers: { A: moolaKit.issuer, B: stockKit.issuer },
  sealers: { A: moolaKit.sealer, B: stockKit.sealer },
});

// 3. Execute exchange
await escrow.escrowExchange(aliceOffer, bobOffer);

// 4. Get sealed tokens (inert, no withdrawal authority)
const sealed = escrow.getSealedPurses();

// 5. Securely retrieve account GUIDs via the purses facet
const moolaEscrowGuid = moolaKit.purses.getGuidFromSealed(sealed.A);
const stockEscrowGuid = stockKit.purses.getGuidFromSealed(sealed.B);
```

## Security Properties

- The sealed token is **inert**: it cannot be used to withdraw funds
- The sealed token is **unforgeable**: only the original sealer can create valid tokens
- Only the matching unsealer (via `purses.getGuidFromSealed`) can extract information
- The `account_guid` is safe to expose: it identifies but does not authorize

## Use Cases

These `account_guid`s allow us to:
- Query the ledger for escrow-related splits
- Build reports showing escrow state
- Integrate with external systems using the account's `code` field

## See Also

- `escrow-accounting.md` - How escrow maps to ledger transactions
- Jessie README on capability discipline: https://github.com/endojs/Jessie
