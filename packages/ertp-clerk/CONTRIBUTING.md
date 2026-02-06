# CONTRIBUTING

Thanks for your interest in contributing! This package will host the worker/service layer for ERTP-ledger access.

## Status checklist

- [ ] Land a Worker-friendly remote capability protocol for ERTP access.
  - [x] Scaffold worker package (wrangler, minimal README/CONTRIBUTING).
  - [x] Add RPC bootstrap and entry points (Cap'n Web initial implementation).
  - [x] Wrap ledgerguise facets for RPC and address identity/stub semantics (capnweb patch).
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

## capnweb identity patch

We currently patch capnweb to preserve identity for export targets when a client sends a capability back to the worker. Without this patch, payments arrive as new import stubs and fail `WeakMap` identity checks (`payment not live`). Track upstream status and remove the patch once capnweb offers a supported identity mapping hook.

## TODO

- [x] Create protocol evaluation notes in `docs-design/` (Waterken web-key summary).
- [ ] Define the RPC interface surface for issuer/brand/purse/payment facets.
- [ ] Decide how capability references will be issued and revoked.
- [ ] Choose deployment target (Cloudflare Workers, workerd, or both) and document local dev.
- [ ] Add request routing conventions (per-ledger DO instance vs per-commodity vs per-org).
- [ ] Add error taxonomy and map ledger errors to HTTP status codes.
- [ ] Confirm whether the wrangler dependency warning about rollup-plugin-inject is acceptable or needs remediation per best practices.
- [ ] Evaluate alternatives to loading capnweb from esm.sh (e.g., bundling locally).
- [ ] Replace better-sqlite3 with a Worker-compatible backend (Durable Object SQLite or D1) and keep IO injected.
- [ ] Use drizzle migrations for schema setup instead of inline bootstrap SQL.
- [ ] Investigate HTTP batch RPC support in wrangler/miniflare (smoke test uses WebSockets for now).
- [ ] Track the capnweb identity patch and remove it once upstream supports returning original export targets.
- [ ] Consider moving the External wrapper into ertp-ledgerguise (Far/exo-style) so facets are RPC-ready.
- [ ] Replace the relative import of ertp-ledgerguise src with a proper package build or bundler config.
