# CONTRIBUTING

Thanks for your interest in contributing! This package will host the worker/service layer for ERTP-ledger access.

## Status checklist

- [x] Land a Worker-friendly remote capability protocol for ERTP access.
  - [x] Scaffold worker package (wrangler, minimal README/CONTRIBUTING).
  - [x] Add RPC bootstrap and entry points (webkey protocol).
  - [x] Wrap ledgerguise facets for RPC and address identity semantics.
  - [x] Provide smoke tests for the worker RPC.
  - [ ] Re-validate end-to-end once ledgerguise is green again.

## Scope

- Keep changes limited to this package unless requested.
- Prefer minimal, explicit interfaces for the worker API.

## Context

- This worker depends on `@finquick/ertp-ledgerguise` behavior and types. Treat this package as a service layer, not the source of ledger semantics.
- End-to-end validation depends on ledgerguise tests passing and the DB backend choices for Workers (Durable Object SQLite vs D1).
- Design notes live in `docs-design/` (start with `docs-design/waterken-webkey.md`).

## Development

- `wrangler dev`
- Smoke test: `npm run smoke` (requires dev server running).

## TODO

- [x] Create protocol evaluation notes in `docs-design/` (Waterken web-key summary).
- [x] Define the RPC interface surface for issuer/brand/purse/payment facets (MVP).
- [x] Document slots-based capability token mapping assumptions.
- [ ] Decide how capability references will be issued and revoked beyond MVP.
- [ ] Choose deployment target (Cloudflare Workers, workerd, or both) and document local dev.
- [ ] Add request routing conventions (per-ledger DO instance vs per-commodity vs per-org).
- [ ] Confirm whether the wrangler dependency warning about rollup-plugin-inject is acceptable or needs remediation per best practices.
- [ ] Replace better-sqlite3 with a Worker-compatible backend (Durable Object SQLite or D1) and keep IO injected.
- [ ] Use drizzle migrations for schema setup instead of inline bootstrap SQL.
- [ ] Consider moving the External wrapper into ertp-ledgerguise (Far/exo-style) so facets are RPC-ready.
- [ ] Replace the relative import of ertp-ledgerguise src with a proper package build or bundler config.
