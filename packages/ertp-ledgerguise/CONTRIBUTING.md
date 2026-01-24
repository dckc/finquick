# CONTRIBUTING

Thanks for your interest in contributing! This package provides an ERTP facade over a GnuCash SQLite database. These notes apply to contributors, including agents.

## Background

- Agoric PR: "SPIKE: toward correct-by-construction Zoe2 escrow" (#8184) https://github.com/Agoric/agoric-sdk/pull/8184
  - Relevant ERTP note: mint/purse patterns and amount math are treated as stable, foundational properties for escrow reasoning.
- Vbank bridge flow: `packages/cosmic-swingset/README-bridge.md` in agoric-sdk (ERTP transfer via vbank).

## Status checklist

- [ ] Create an ERTP-compatible facade backed by a GnuCash SQLite DB.
  - [x] Establish contributor/agent guidance in `CONTRIBUTING` (planning phases, ocap IO injection, freeze API surface, testing discipline).
  - [x] Build a minimal ERTP-like API (issuer/brand/purse/payment) mapped to GnuCash accounts/splits.
  - [x] Add tests for canonical ERTP flows (Alice->Bob $10), persistence, and adversarial cases.
  - [x] Implement escrow semantics in GnuCash (holding account, tx/split rules).
  - [x] Add a pure-ERTP escrow module and unit tests (no DB).
  - [x] Build the community story/simulation (chart placement, contributions, reports).
  - [x] Keep ocap/no-ambient-IO, freeze API surfaces, no CJS, docs aligned to API.
  - [x] Restore `lint:types` after changing `tsconfig.json` `lib` to `ESNext` (SqlDatabase type mismatch with better-sqlite3).
    - [x] Abstract: define a backend-agnostic SqlDatabase interface for sync sqlite.
    - [x] Concrete: add a better-sqlite3 shim and use it in tests.
  - [ ] Figure out how to persist escrow exchanges at each state change.

## Planning

- Brainstorm and write down the initial motivation (ERTP + GnuCash insight).
- Scaffold the canonical “Alice sends Bob $10” ERTP test so it fails.
- Make the test pass (starting with the simplest implementation, even if it is not DB-backed yet).
- Capture each new design constraint as a failing test, then make it pass.
- Design adversarial tests that probe for theft, destruction, or misdirection of funds.

## Scope

- Keep changes limited to this package unless the user asks for cross-package updates.
- Prefer small, targeted edits; avoid refactors unless explicitly requested.

## Data and DB safety

- Treat the GnuCash SQLite file as production-like data; do not run destructive SQL.
- When inspecting schema/data, use read-only queries.
- Do not migrate or alter schemas unless explicitly requested.
- TODO: set migrations aside for now; start with in-memory databases.

## Code style

- Follow existing patterns in this package.
- Add succinct comments only when logic is non-obvious.
- Keep files ASCII unless the file already uses Unicode.
- Avoid functions with more than 3 positional arguments; prefer a single options/config object with named properties.
- Use JSDoc docstrings when attaching documentation to declarations or parameters; reserve `//` comments for implementation details.

## Testing

- If tests exist, prefer the smallest relevant test(s).
- Never create or modify real ledger data during tests; use fixtures or in-memory DBs when possible.

## Tooling

- Use `rg` for searches.
- Avoid network access unless explicitly requested.
- Use `npm run codegen:sql` to regenerate `src/sql/gc_empty.ts` from `sql/gc_empty.sql`. Keep codegen scripts ESM (no `.cjs`).
- No CommonJS in this package (source, tests, scripts). Use ESM everywhere.
- TODO: use full extensions in module specifiers.

## Entry points and structure

- `src/index.ts`: main facade entry points; table of contents in file header.
- `src/escrow.ts`: GnuCash-backed escrow logic.
- `src/escrow-ertp.ts`: ERTP-only escrow (no DB).
- `src/jessie-tools.ts`: freeze helpers and Nat guard.
- `src/sql/`: schema and SQL helpers.
- `test/`: canonical flow, persistence, adversarial, escrow, and community tests.

## Agent Tactics

the mutable let point is not agent tactics; it's code style. likewise API
  surface stuff. make a new subsection for the API surface freezing stuff.

### Commit Ritual

- Propose commit boundaries before committing when multiple changes are in play.
- Use conventional commit headers and focus the subject on the most important user-facing change.
- Provide a draft commit message for review before creating the commit.
- In the body, detail all changes with indented bullets.
- Only commit after explicit user approval.

### General Tactics

- Always check for static errors before running tests.
- Always run all tests relevant to any code changes before asking the user for further input.
- When fixing a bug, capture it with a failing test before applying the fix.
- Prefer avoiding mutable `let` for tests; use an IIFE or other pattern so types can be inferred.
- Freeze API surface before use: any object literal, array literal, or function literal that escapes its creation context should be frozen (use `const { freeze } = Object;` and `freeze(...)`). Source: Jessie README, "Must freeze API Surface Before Use": https://github.com/endojs/Jessie/blob/main/README.md
- Only freeze values you create (literals/functions). Do not freeze objects you receive from elsewhere (e.g., kit or purse objects returned by libraries); treat them as already-sealed API surfaces.
- TODO: add static analysis to enforce API surface freezing.

## IBIS: Sync vs async DB access

Issue: Should the GnuCash-backed ERTP facade use synchronous or asynchronous DB access?

Position A (sync DB access):
- Closer to ERTP's synchronous semantics (e.g., brand/purse/amount operations are typically sync).
- Easier to reason about atomicity in a single vat/turn; fewer interleavings.
- Aligns with Node bindings like `better-sqlite3` and some WASM in-memory modes.

Position B (async DB access):
- Required in many environments (Cloudflare Workers/D1, OPFS-backed WASM, remote sqlite).
- Matches vbank's observed split: synchronous "grab/give" bridge calls, but asynchronous balance updates (end_block).
- Avoids blocking the event loop in hosted environments; better scalability.

Discussion:
- ERTP APIs are sync, but can be backed by async IO by pushing IO to injected capabilities and keeping synchronous facade operations limited to preloaded or cached data.
- A hybrid model is possible: sync for hot reads/derived state, async for persistence and reconciliation, similar to vbank's immediate bridge actions plus later balance update notifications.

Decision: Start with synchronous DB access, but keep IO injected so async backends can be added later.

Consequences:
- Tests should allow in-memory sync adapters first, with async-capable adapters introduced later.
- The facade should avoid hidden filesystem opens; pass DB capabilities explicitly (ocap discipline).

## IBIS: Payment holds vs immediate transfers

Issue: How should in-flight payments be represented in the GnuCash ledger?

Position A (account-to-account only, no holds):
- Only record direct account-to-account transfers at deposit time.
- Avoids “hold” rows but loses in-flight payment durability and makes GC destroy value.
- Requires deferred ledger writes, which hides exposure windows.

Position B (mutable hold transaction):
- Record a hold transaction at withdraw time from source to a holding account.
- On deposit, update the holding split to the destination account and mark splits cleared.
- Preserves a single transaction per payment while keeping a durable record.

Decision: Use the mutable hold transaction approach with a holding account and reconcile-state updates.

Consequences:
- Transfers remain auditable via a single tx with two splits after deposit.
- We accept that split destination mutation is part of the model and must be tested.

## Documentation

- Update package docs or README when behavior or public API changes.

## TODO
- Consider Flow B (accrual then payout): record contributor payable before minting.
- Consider periodic minting (budgeted supply) vs per-contribution minting.
- Consider a read-only openIssuerKit facade with a reduced capability surface:
  - No account access (no make/open purse).
  - No mint access.
  - No escrow access.
  - Expose brand and displayInfo for identification.
  - Expose issuer.getAmountOf / issuer.isLive for payment inspection.
  - Optional: read-only chart/balance reporting facet (account tree, balances, recent txs).
  - Keep payment reification behind a separate explicit capability if needed.
- Consider generalizing escrow beyond a single brand (e.g., $ for stock). Two design options:
  - Dual-transaction escrow (one transaction per brand):
    - Use one holding account per brand; write two transactions with a shared offer ID/check number.
    - Each transaction stays single-commodity (currency_guid matches the brand commodity).
    - Accept/cancel retargets each brand's holding split to the destination/source account.
    - Pros: avoids TRADING accounts; preserves current ledger invariants.
    - Cons: two txs to correlate; needs shared offer ID and consistency checks.
  - Single-transaction with TRADING splits:
    - Create a single transaction with both commodities plus balancing splits to a TRADING account.
    - Leverages GnuCash's multi-commodity transaction model.
    - Pros: one tx per offer; native to GnuCash if configured correctly.
    - Cons: requires TRADING accounts and correct valuation; more complex and harder to audit.
