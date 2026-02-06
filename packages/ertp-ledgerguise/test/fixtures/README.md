# Fixtures: ERTP to GnuCash Table Shapes

These CSVs are example-first specs for how ERTP actions map into GnuCash SQL
tables. They are not exhaustive; they show the intended *shape* and example
values for key rows.

## Conventions

- GUIDs are illustrative placeholders (not real UUIDs).
- `comm-USD` is a placeholder for the commodity GUID used in tests.
- `acct-source` is the payment source account (mint recovery).
- `acct-dest` is the destination purse account.
- `value_num` / `value_denom` use GnuCash numeric representation.
- `reconcile_state` uses `n` (not reconciled) and `c` (cleared/reconciled).
- Dates are example timestamps.

## Files

- `withdraw-deposit-transactions.csv` and `withdraw-deposit-splits.csv`
  show the final post-deposit state for a single payment.
- `escrow-commit-transactions.csv` and `escrow-commit-splits.csv`
  show the final post-commit state for a two-party escrow.
