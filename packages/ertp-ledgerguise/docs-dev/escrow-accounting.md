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

See `docs-dev/gi_mi_x_ami_x_system_summary_for_llm_prompting.md` for the full AMIX model.

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

## Implementation Notes

- Funding uses `Promise<Payment>` to model async timing
- The `reconcile_state` column tracks hold status: `'n'` = pending, `'c'` = cleared
- Escrow purses are created via `issuer.makeEmptyPurse()` and optionally named via `chartFacet.placePurse()`

## See Also

- `test/snapshots/design-doc.test.ts.md` - Executable documentation showing ledger state at each step
- `sealer-unsealer.md` - Secure identification of escrow accounts
