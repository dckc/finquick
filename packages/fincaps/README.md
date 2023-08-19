# fincaps - confined finance stuff

The endo daemon and CLI recently grew support for web pages.
Seems like it could work like Capper.

- weblet(s) for UI(s)
- unconfined worker for access to gnucash db via sqlite
- unconfined worker for access to google sheets
- confined workers to connect them

## Hello world weblet

Currently, we have a hello world:

```sh
endo open hello ./src/pg1.js --powers HOST
```

The `--powers HOST` results in providing an `EndoHost` (ref
[endo daemon types](https://github.com/endojs/endo/blob/endo/packages/daemon/src/types.d.ts)) to `make` in `pg1.js`.

## Refs

- [feat\(daemon\): Weblets by kriskowal · Pull Request \#1658 · endojs/endo](https://github.com/endojs/endo/pull/1658)

based on [endo](https://github.com/endojs/endo/tree/endo) branch. currently:

- 2023-08-17 16:31 `3918dccd7` refactor(daemon): Relax some pet name constraints
