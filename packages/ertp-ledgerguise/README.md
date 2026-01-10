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

## Status

Early sketch; API surface and mappings are expected to evolve.

## Name

"Ledgerguise" hints at an ERTP exterior wrapping a GnuCash ledger interior.
