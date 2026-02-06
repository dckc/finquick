# Waterken Web-Key Protocol and ERTP Fit

## Context

ERTP for Cloudflare Workers needs a robust remote capability protocol that preserves object identity across the network boundary, supports passing capabilities back to the service, and can be implemented in a Worker + Durable Objects environment. Cap'n Web (capnweb) currently requires an identity-preservation patch in `ertp-clerk` to keep `WeakMap`-based identity checks working. That makes Cap'n Web one possible strategy, not the only one.

This note summarizes the Waterken web-key protocol and evaluates it for ERTP, based on:

- The Waterken web-key paper (public spec).
- Capper implementation (`~/projects/Capper`) and the `ofxies` package usage in this repo.

## Waterken Web-Key Summary (Protocol-Level)

At a high level, a *web-key* is an unguessable HTTPS URL that *is* the permission to a resource. Key points from the Waterken design:

- **Key material lives in the URL fragment** (`#...`) so it is not sent in the HTTP request and is not leaked via the `Referer` header. The browser loads a skeleton page, extracts the fragment, and then performs a follow-on HTTPS request where the key is placed in a query parameter. This yields a standard HTTPS request while keeping the key out of referrers and most logs.
- **Key-bearing URLs are the capability**. Distribution of the URL is distribution of authority. No additional login or password is required.
- **Protocol is browser-friendly**. It relies on client-side code plus HTTPS, so it works in existing browsers without special plugins.

The paper does not define an RPC object model by itself; it specifies how to carry *permission* using URLs. Capper provides a concrete object-capability RPC on top of this convention.

## Capper’s Concrete Web-Key RPC (Observed)

Capper uses the Waterken convention as a capability transport and defines a JSON-over-HTTP RPC for invoking methods on exportable objects.

Observed behavior in Capper:

- **Webkey format**: `https://host/ocaps/#s=<cred>` (credential in fragment). See Capper’s README and `server.js`.
- **RPC request**: `POST /ocaps/?s=<cred>&q=<method>` with JSON array body of arguments.
- **Capability passing**: Arguments that are object references are serialized as `{"@": "<webkey>"}`. The server resolves these back to live objects via `webkeyToLive`.
- **RPC result**: JSON object with one of `{"=": value}`, `{"@": webkey}`, or `{"!": error}`. Capper also rewrites nested return values, replacing live objects with webkeys.

The `ofxies` package demonstrates CLI flows using Capper’s conventions: `-make`, `-post`, `-drop`, and passing webkeys around as opaque authority-bearing strings (`packages/ofxies/README.md`, `packages/ofxies/server.js`).

## Evaluation for ERTP in Cloudflare Workers

### What ERTP needs

ERTP relies on:

- **Stable object identity** across a distributed boundary (e.g., payments/purses/issuers returned to clients and later passed back). In `ertp-ledgerguise`, identity checks use `WeakMap` to confirm “live” payments.
- **Capability passing** (issuers/brands/purses/payments as capabilities), including returning and accepting them in RPC arguments.
- **Revocation/attenuation** patterns (e.g., minting limited-purpose facets or dropping a payment).
- **Durability** for long-lived capabilities (brands, issuers, purses) and short-lived capabilities (payments).

### Strengths of Waterken Web-Keys for ERTP

- **Identity preservation is natural for sturdy refs**: the webkey credential can map back to the same persistent object, satisfying `WeakMap` identity checks so long as the server’s `cred -> object` mapping is stable.
- **Capability passing is first-class**: webkeys are explicitly designed as transferable permissions. Capper’s `{"@": webkey}` encoding maps well onto ERTP’s capability passing model.
- **Revocation aligns with ocap practice**: Capper’s `drop` plus state-based revocation patterns match ERTP’s expectations for revoking or exhausting payments.
- **Cloudflare Workers fit**: the protocol is just HTTPS + JSON, so a Worker + Durable Object can host it without special transports.

### Gaps / Concerns

- **Ephemeral identity**: Capper only encodes persistent exportable objects. ERTP has short-lived payments that may need to remain “live” during transfer. That implies payments must be backed by a persistent record (or a durable DO instance) to keep identity stable across round trips.
- **Object reference equality across domains**: webkeys are URLs. If two distinct URLs can refer to the same object (aliases), equality checks become ambiguous. The design should enforce a canonical webkey per object or normalize them before identity comparisons.
- **Lack of protocol-level pipelining**: Capper’s RPC is simple request/response without promise pipelining. ERTP doesn’t require pipelining, but it may affect latency-sensitive workflows.

### Overall adequacy assessment

Waterken web-keys, as concretely implemented by Capper, appear *adequate* as a remote capability substrate for ERTP in Cloudflare Workers, provided we:

1. **Treat all remotely transferable ERTP facets as sturdy refs** with stable `cred -> object` mappings backed by Durable Object state or a database.
2. **Define a canonicalization rule** for webkeys to preserve identity semantics (one object == one canonical webkey).
3. **Document failure behaviors for ERTP methods**, given errors are sealed and any caller-visible signals should be returned as non-error values.

Under these constraints, the Waterken web-key approach provides a simpler, Worker-friendly alternative to Cap'n Web while preserving the remote object identity ERTP needs.

## Suggested next steps

- Draft an ERTP-over-webkey interface spec (issuer/brand/purse/payment methods + error mapping).
- Decide on a canonical webkey scheme for Workers (path + fragment policy, or path + query-only if avoiding fragments on non-browser clients).
- Define how payments become durable (DO-backed, DB-backed, or explicitly minted to stable IDs).

## Using GnuCash GUIDs as Webkey Material (IBIS)

**Issue**

Should GnuCash GUIDs be used as Waterken webkey credentials in the ERTP
Cloudflare Workers design?

**Context / Observations**

- `makeDeterministicGuid(seed)` hashes a seed string to a 32-hex GUID.
- `makeGuid()` is injected; in the Worker integration it is built from `crypto.randomUUID()`.
- Deterministic GUID seeds in `ertp-ledgerguise` include
  `ledgerguise-balance:${commodityGuid}` and `ledgerguise:recovery:${commodityGuid}`.
- `purses.getGuid(purse)` and `purses.getGuidFromSealed(token)` intentionally reveal
  account GUIDs to callers who hold those privileged facets.

**Positions**

1. **Use GnuCash GUIDs directly as webkey credentials.**
2. **Use deterministic GUIDs (hash of seed) as credentials.**
3. **Use random GUIDs as credentials.**
4. **Split identity (GUID) from capability (token).**
5. **GUID + MAC (stateless credential).**

**Arguments**

- Against (1): In this design, GUID disclosure is used for *identification* and
  accounting (via privileged facets) without intending to grant purse access.
  If GUIDs were credentials, those identification channels would become access
  channels, collapsing the POLA separation between “identify” and “act.”
Comment (existence proof): `purses.getGuidFromSealed(token)` is intentionally
*identifying*; if “account GUID == webkey credential,” then a holder of the `purses`
facet plus a sealed token could construct a webkey that grants purse authority.
That turns identification-only authority into access authority.
- Against (2): Seeds include `commodityGuid`. Any party that learns `commodityGuid`
  can derive the balance/recovery GUIDs exactly, which would confer authority to
  anyone with that knowledge.
- Against (3): Random GUIDs are only safe if never exposed. In this codebase GUIDs
  are exposed via privileged facets, so a random GUID should be treated as identity,
  not as a capability secret, unless explicitly isolated.
- For (4): Preserves POLA and matches current code: GUIDs remain object IDs while
  capability tokens are minted and handed out intentionally.
- For (5): Avoids per-token storage and keeps GUIDs as IDs, but pushes revocation
  to MAC key rotation and requires careful key handling.

**Decision**

Do **not** use GnuCash GUIDs (deterministic or random) as webkey credentials in this
codebase. Treat GUIDs as object IDs only. Use a separate capability token for webkeys.

**Parsimonious design**

- **Split ID from capability**: map a separate random token (webkey credential) to a
  GUID in server state. This is the simplest design that preserves POLA and matches
  the current facet split.

Constraint: do not add new tables; stay within the GnuCash schema.

Within that constraint, the least invasive approach that preserves lookup
performance is to store the token → GUID mapping in the existing `slots` table
using the *indexed* `obj_guid` column for the token:

- Store the **token** in `slots.obj_guid` (indexed).
- Store the **object GUID** in `slots.guid_val`.
- Use a dedicated `name` (e.g., `ledgerguise.webkey`) to disambiguate.

Lookup flow:

1. Incoming webkey token → lookup `slots` by `obj_guid` + `name`.
2. Resolve the owning object GUID from `guid_val`.
3. Route the request to the corresponding object/facet.

Revocation is a slot delete. Rotation is a new slot with a new `obj_guid` token.

Note: these slot rows are not attached to an object GUID via `obj_guid`, so any
tooling that expects `slots.obj_guid` to always be a real object GUID will ignore
them. If you need an object → token lookup, return the token at mint time (no
reverse lookup), or add a *second* non-indexed slot keyed by the object GUID.

Additional clarifications:

- This design **diverges from Capper**: Capper treats the credential as the object
  identity (cred == id). Here the credential is a separate token that points to
  the object GUID.
- Token → object mapping must be **persistent** to provide sturdy refs across
  restarts; an in-memory map would make webkeys ephemeral.
- Object GUIDs are **not** part of the webkey protocol itself, but they are
  exposed via privileged facets and admin flows. Split-ID preserves POLA by
  letting those identifiers be shared without granting capability access.

**Optional variant**

- **GUID + MAC**: include the GUID plus an authenticator (e.g., HMAC) in the webkey to
  avoid per-token storage, at the cost of key-rotation based revocation.

## References

1. Close, Tyler. 2008. *Web-key: Mashing with Permission.* Web 2.0 Security & Privacy (W2SP 2008). https://waterken.sourceforge.net/web-key/web-key-w2sp08.pdf
2. Stiegler, Marc. 2014. *Capper* (software framework). https://github.com/marcsAtSkyhunter/Capper
