# CONTRIBUTING

Thanks for your interest in contributing! This package provides an ERTP facade over a GnuCash SQLite database.

Before submitting changes, please run:

```sh
yarn check   # runs yarn lint && yarn test
```

We use conventional commits (e.g., `feat:`, `fix:`, `test:`, `docs:`).

## Background

- Agoric PR: "SPIKE: toward correct-by-construction Zoe2 escrow" (#8184) https://github.com/Agoric/agoric-sdk/pull/8184
- Vbank bridge flow: `packages/cosmic-swingset/README-bridge.md` in agoric-sdk

## Design

ERTP concepts map to GnuCash:

| ERTP    | GnuCash                                                      |
| ------- | ------------------------------------------------------------ |
| Brand   | Commodity                                                    |
| Purse   | Account                                                      |
| Payment | Transaction + splits (`reconcile_state='n'` until deposited) |
| Amount  | Brand + `value_num / value_denom`                            |

Detailed design docs are in `docs-dev/`:

- `escrow-accounting.md` - Ledger transactions, payment holds, AMIX state machine
- `integration.md` - Account codes, cross-system integration
- `ocap-discipline.md` - Capability injection, encapsulation, sealer/unsealer

The primary documentation of how ERTP is embedded in GnuCash is `test/snapshots/design-doc.test.ts.md`, integrated with the test suite.

## Code style

We use ESM (no CommonJS). Avoid more than 3 positional arguments; use an options object instead. Freeze API surfaces before use—see [jessie-tools](https://www.npmjs.com/package/jessie-tools) for the API or `docs-dev/ocap-discipline.md` for rationale.

For JSDoc, put detailed documentation on the exported functions/classes so it appears when hovering over call sites. Keep `@file` comments brief (one line) with `@see` links to the main entrypoints.

## Testing

We use in-memory databases for tests—never modify real ledger files. When fixing bugs, please capture them as failing tests first.

For multi-party scenarios, encapsulate each actor to follow POLA (Principle of Least Authority). Actors own their purses privately and expose only narrow interfaces (e.g., deposit facets). See `test/escrow-db.test.ts` for an example and `docs-dev/ocap-discipline.md` for rationale.

## Data safety

Please treat GnuCash SQLite files as production data. Use read-only queries when exploring; avoid destructive SQL.

## Agent tactics

These guidelines help AI agents contribute effectively:

- Run `yarn check`:
  - Before your first change in a session
  - After each change
  - Fix minor issues.
  - Stop and ask about significant or unexpected challenges.
  - Never present work as complete that doesn't pass `yarn check`.
- Consider checking `yarn lint:types` before running tests to catch type errors early.
- Test-driven development is valued, but not required when tests are not cost-effective
  (e.g. early prototyping or if developing a test would be probihibitvely expensive)
  - When fixing a bug, we know a test is cost-effective; capture it with a failing test before applying the fix.
- Freeze API surfaces before returning them. Per Jessie conventions, use `Object.freeze()`:
  ```js
  const { freeze } = Object;
  return freeze({
    method1,
    method2,
  });
  ```
  `freezeProps()` or `zone.exo()` can be handy.
- Before committing:
  - Review work to see whether atomic commits should be separated
  - Propose commit headings for review
  - Focus each heading on the most significant impact—don't water it down (e.g., "lots of updates")
  - Enumerate ancillary changes in the commit body

## Status and future work

**Done:**

- [x] ERTP-like API (issuer/brand/purse/payment) mapped to GnuCash
- [x] Escrow exchange with async funding via `Promise<Payment>` (escrow-ertp.ts)
- [x] Account hierarchy with placeholder parents and codes (ChartFacet)
- [x] Ocap discipline: injected clock/db, frozen API surfaces
- [x] Multi-commodity escrow with proper GnuCash stock-trade format (SettlementFacet)
- [x] Design doc as executable snapshot tests (test/snapshots/design-doc.test.ts.md)

**To do:**

- [ ] Persist escrow state at each transition (crash recovery)
- [ ] Read-only issuer facade (brand/displayInfo only)
- [ ] Community rewards/budget voting (separate from escrow)
