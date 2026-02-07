# Escrow Accounting Model

How ERTP escrow maps to double-entry bookkeeping in GnuCash.

## Core Principle

The `escrow-ertp.ts` logic uses a two-purse system for atomic swaps, which maps cleanly to a double-entry ledger. Each escrow arrangement is treated as a temporary holder of assets, with its own accounts within the ledger.

## Account Hierarchy

An account hierarchy under `Escrow` is created for each deal, ensuring funds are never commingled. For an arrangement identified as `deal-123` to swap `Moola` and `Stock`:

```
Escrow
  deal-123
    Moola
    Stock
```

## Transaction Lifecycle

### 1. Funding (Async, Separate Transactions)

Parties fund asynchronously via `Promise<Payment>`. Alice may fund before Bob, or vice versa.

**Alice deposits 10 Moola:**

| Account                    | Debit | Credit |
|----------------------------|-------|--------|
| Escrow:deal-123:Moola      | +10   |        |
| Alice:Moola                |       | -10    |

**Bob deposits 1 Stock:**

| Account                    | Debit | Credit |
|----------------------------|-------|--------|
| Escrow:deal-123:Stock      | +1    |        |
| Bob:Stock                  |       | -1     |

### 2. Settlement (Single Atomic Transaction)

To preserve atomicity on the ledger, the swap is recorded as a single transaction with four splits.

**"Settle deal-123: Alice gets Stock, Bob gets Moola"**

| Account                    | Debit | Credit |
|----------------------------|-------|--------|
| Bob:Moola                  | +10   |        |
| Escrow:deal-123:Moola      |       | -10    |
| Alice:Stock                | +1    |        |
| Escrow:deal-123:Stock      |       | -1     |

### 3. Cancellation (Single Atomic Transaction)

A cancellation returns funds to their owners as a single atomic transaction.

**"Cancel deal-123: Assets returned"**

| Account                    | Debit | Credit |
|----------------------------|-------|--------|
| Alice:Moola                | +10   |        |
| Escrow:deal-123:Moola      |       | -10    |
| Bob:Stock                  | +1    |        |
| Escrow:deal-123:Stock      |       | -1     |

## AMIX State Machine

The escrow follows the AMIX (American Information Exchange) state machine pattern:

```
Agreement → [Party A Funds] → [Party B Funds] → Settlement
                 ↓                  ↓
            (cancellation triggers refund)
```

See `amix-gimix-background.md` for the full AMIX model.

## IBIS: Payment Holds vs Immediate Transfers

**Issue:** How should in-flight payments be represented in the GnuCash ledger?

**Position A (no holds):**
- Only record transfers at deposit time
- Simpler model, fewer rows
- But: loses in-flight payment durability; if process crashes, value disappears

**Position B (mutable hold transaction):**
- `withdraw()` creates a hold transaction with `reconcile_state='n'`
- `deposit()` retargets the split to the destination and sets `reconcile_state='c'`
- Preserves a single transaction per payment with durable record

**Decision:** Use mutable hold transactions.

**Consequences:**
- Transfers remain auditable as single transactions after deposit
- Split destination mutation is part of the model (tested in `design-doc.test.ts`)
- The `reconcile_state` column serves double duty: GnuCash reconciliation + hold tracking

## IBIS: Sync vs Async DB Access

The hold transaction model above assumes we can atomically write to the database. This raises the question of sync vs async access.

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

## Escrow Account Identification

To query ledger rows for an escrow arrangement, we need the account GUIDs of the escrow purses. But returning the `Purse` objects would leak withdrawal authority (POLA violation).

The sealer/unsealer pattern solves this:

```js
// Escrow creates internal purses, seals them
const escrow = makeErtpEscrow({
  issuers: { A: moolaKit.issuer, B: stockKit.issuer },
  sealers: { A: moolaKit.sealer, B: stockKit.sealer },
});

// Get sealed tokens (inert, no withdrawal authority)
const sealed = escrow.getSealedPurses();

// Retrieve account GUIDs via the issuerKit's purses facet
const moolaEscrowGuid = moolaKit.purses.getGuidFromSealed(sealed.A);
const stockEscrowGuid = stockKit.purses.getGuidFromSealed(sealed.B);

// Now we can query the ledger for these accounts
db.prepare('SELECT * FROM splits WHERE account_guid = ?').all(moolaEscrowGuid);
```

The `account_guid` is safe to expose: it identifies but does not authorize.

## Implementation Notes

- Funding uses `Promise<Payment>` to model async timing
- The `reconcile_state` column tracks hold status: `'n'` = pending, `'c'` = cleared
- Escrow purses are created via `issuer.makeEmptyPurse()` and optionally named via `chartFacet.placePurse({ sealedPurse, ... })`

## See Also

- `test/snapshots/design-doc.test.ts.md` - Ledger state at each escrow step
- `src/sealer.ts` - Sealer/unsealer implementation
- `ocap-discipline.md` - Capability patterns and rationale
