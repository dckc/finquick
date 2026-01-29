# ertp-ledgerguise

ERTP-compatible facade over a GnuCash SQLite database.

## Goals

- Provide ERTP-like interfaces (issuer, brand, purse, payment, amount) backed by GnuCash data.
- Keep persistence in the GnuCash sqlite file without introducing a separate durable store.
- Make it feasible to swap an ERTP surface onto existing GnuCash ledgers.

## Non-goals

- Schema migrations or destructive DB changes.
- A new UI or a full GnuCash replacement.
- Automated bank/card syncing (handled elsewhere in finquick).

## Documentation

The primary documentation is `test/snapshots/design-doc.test.ts.md` — a narrative snapshot-based design doc showing how ERTP concepts map to GnuCash:

- Mint and deposit → transactions/splits
- Chart of accounts → ChartFacet for naming purses
- Withdraw creates hold → reconcile_state tracking
- Escrow exchange → AMIX-style state machine
- Settlement → SettlementFacet for GnuCash stock-trade format

See also `docs-dev/` for background on escrow accounting, ocap discipline, and integration patterns.

## Status

Core ERTP→GnuCash mapping is stable. Contributions welcome—see `CONTRIBUTING.md` for guidelines.

## Name

"Ledgerguise" hints at an ERTP exterior wrapping a GnuCash ledger interior.
