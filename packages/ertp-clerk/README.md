# ertp-clerk

ERTP ledger access over Cap'n Web, hosted as a Cloudflare Worker.

## Usage

- Visit `/` to load a small page that exposes `globalThis.bootstrap` in the browser console.
- Call `await bootstrap.makeIssuerKit("BUCKS")` to obtain issuer facets backed by the durable ledger.
- POST or WebSocket requests to `/api` speak Cap'n Web RPC; other endpoints return 501/204.
