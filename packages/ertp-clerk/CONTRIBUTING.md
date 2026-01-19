# CONTRIBUTING

Thanks for your interest in contributing! This package will host the worker/service layer for ERTP-ledger access.

## Scope

- Keep changes limited to this package unless requested.
- Prefer minimal, explicit interfaces for the worker API.

## Development

- `wrangler dev`

## TODO

- Define the Cap'n Web interface surface for issuer/brand/purse/payment facets.
- Decide how capability references will be issued and revoked.
- Choose deployment target (Cloudflare Workers, workerd, or both) and document local dev.
- Add request routing conventions (per-ledger DO instance vs per-commodity vs per-org).
- Add error taxonomy and map ledger errors to HTTP status codes.
- Confirm whether the wrangler dependency warning about rollup-plugin-inject is acceptable or needs remediation per best practices.
- Evaluate alternatives to loading capnweb from esm.sh (e.g., bundling locally).
- Replace better-sqlite3 with a Worker-compatible backend (Durable Object SQLite or D1) and keep IO injected.
- Consider moving the External wrapper into ertp-ledgerguise (Far/exo-style) so facets are RPC-ready.
