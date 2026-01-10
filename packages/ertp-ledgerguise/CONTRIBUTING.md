# CONTRIBUTING

Thanks for your interest in contributing! This package provides an ERTP facade over a GnuCash SQLite database. These notes apply to contributors, including agents.

## Background

- Agoric PR: "SPIKE: toward correct-by-construction Zoe2 escrow" (#8184) https://github.com/Agoric/agoric-sdk/pull/8184
  - Relevant ERTP note: mint/purse patterns and amount math are treated as stable, foundational properties for escrow reasoning.
- Vbank bridge flow: `packages/cosmic-swingset/README-bridge.md` in agoric-sdk (ERTP transfer via vbank).

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

## Testing

- If tests exist, prefer the smallest relevant test(s).
- Never create or modify real ledger data during tests; use fixtures or in-memory DBs when possible.

## Tooling

- Use `rg` for searches.
- Avoid network access unless explicitly requested.
- Use `npm run codegen:sql` to regenerate `src/sql/gc_empty.ts` from `sql/gc_empty.sql`. Keep codegen scripts ESM (no `.cjs`).
- No CommonJS in this package (source, tests, scripts). Use ESM everywhere.
- TODO: use full extensions in module specifiers.

## Agent Tactics

the mutable let point is not agent tactics; it's code style. likewise API
  surface stuff. make a new subsection for the API surface freezing stuff.

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

## Documentation

- Update package docs or README when behavior or public API changes.
