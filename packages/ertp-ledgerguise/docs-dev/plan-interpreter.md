# Plan + Interpreter Pattern

**Status: Aspirational - not yet implemented**

## Goal

Make the ERTP-to-GnuCash mapping readable directly from code by separating
declarative "plans" (relational intent) from effectful execution (SQL/Drizzle),
so intent can be reviewed without reading SQL and refactors do not blur
semantics.

## Pattern

- Define a small set of *plan steps* that represent relational intent
  (select, retarget, mark reconciled).
- Build pure plan constructors in the domain layer.
- Execute plans in a single interpreter that performs SQL/Drizzle updates.

This keeps specs readable in code while isolating imperative DB effects.

### Example: Deposit (plan)

- Find payment's holding split (by tx + holding account).
- Retarget that split to destination account.
- Mark affected splits reconciled.

### Example: Deposit (interpreter)

- Resolve the "hold split" via a select.
- Apply updates with a single SQL/Drizzle update per step.

## Mapping: ERTP message -> Relational intent

Treat each ERTP message as a plan of relational rewrites:

- `withdraw(amount)` -> create holding transaction + splits
- `deposit(payment)` -> retarget holding split + reconcile

The intent should be described as plan steps, not inline SQL.

## Static checks vs tests

Plans make some checks static:

- Plan shape checks (deposit must include retarget + reconcile).
- Capability discipline (no ambient IO or DB access leaks in plans).
- Data-flow invariants (hold IDs are produced before finalize steps).

Still needs runtime tests:

- Actual DB state changes and schema constraints.
- Ordering/race effects and promise timing.
- End-to-end integration against real sqlite backends.

Use static checks for structure and capability hygiene, and keep a small set
of runtime tests for correctness.

## Operational Notes

- The interpreter can be swapped (Drizzle, better-sqlite3, D1).
- Plans are stable documentation: they are the spec.
- Tests should assert outcomes; plan shapes can be snapshot-tested if needed.

## Next Steps

- Implement `planDeposit` and `runPlan`.
- Refactor `transferRecorder.finalizeHold` to use the plan/interpreter.
- Consider a small RA-inspired DSL only if plan shapes become repetitive.
