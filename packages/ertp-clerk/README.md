# ertp-clerk

ERTP ledger access hosted as a Cloudflare Worker. The remote capability
protocol is WIP; see CONTRIBUTING.

## Usage

- Visit `/` to load a small page that exposes `globalThis.bootstrap` in the browser console.
- Call `await bootstrap.makeIssuerKit("BUCKS")` to obtain issuer facets backed by the durable ledger.
- `/api` is the RPC endpoint. The concrete protocol is under active evaluation
  (see `docs-design/waterken-webkey.md`).
