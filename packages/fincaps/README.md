# fincaps - confined finance stuff

## Plugins with POLA: Google Sheets, Desktop Secrets, sqlite3

Each of these plugins provdes POLA-shaped access:

- `dbTool.js` - Using the `NameHub.lookup()` protocol,
  `DBHub.lookup(filepath)` gives a `DBTool`. Or
  `DBHub.lookup(filepath, table)` gives a `TableRdWr`.
  `TableRdWr.subTable({ col1: val1, col2: val2})` gives
  access to rows `where col1=val1 and col2 = val2`.
  `TableRdWr.lookup(col1, val1, col2, val2)` gives the same.
  `TableRdWr.readOnly()` gives a `TableRd`.
- `secret-tool.js` - `SecretTool.makePasskey(attrs1)`
  makes a `PassKey`. From there, `E(p).subKey(attrs2)`
  attenuates access to items with `{ ...attrs2, ...attrs1 }`.
- `sheetsTool.js` - `SheetsTool.load(item)` uses a
  `PassKey` to access a Google Sheet as a `SpreadsheetWr`
  with a `.readOnly()` attenuation method.
  `lookup()` support is TODO, but
  `E(gsheet).getSheetByTitle(title)` gets
  a `WorksheetWr` with `.readOnly()`.
  Attenuation to rows / columns is not yet supported.

TODO: defensive correctness in the case of unexpected args.

## Sync GnuCash sqlite DB with a Google Sheet

In `../lm-sync/src/sheetsAccess.js`, we have a tool
to sync between a GnuCash sqlite3 database and a
Google spreadsheet. Credentials to access the spreadsheet
come from environment variables and a key file.
The code respects POLA to some extent, but
it's all in one vat/realm and its realm
is not hardened.

Using the plugins above, `txSync.js` runs as a confined
worker (reminiscent of Capper). The current UI is a `Makefile`:

```
$ make
state: /home/connolly/.local/state/endo

$ make clean
endo reset

$ make sync
++ instantiate confined sync tool
endo make src/txSync.js -n synctool
Object [Alleged: SyncTool] {}

++ Instantiate sqlite3 database hub plugin
endo make -n hub1 --UNSAFE ./src/dbTool.js
Object [Alleged: DBHub] {}
++ Choose a sqlite3 database file path
endo eval "'${GNUCASH_DB}'" -n p1
++ look up the path in the DBHub
endo eval "E(hub).lookup(path)" hub:hub1 path:p1 -n gcdb
Object [Alleged: DBTool] {}

++ make endo plugin for desktop secrets
endo make -n desktop-secrets --UNSAFE ./src/secret-tool.js
Object [Alleged: SecretTool] {}
++ make a PassKey to access finSync Google Sheet
++ Assumes: secret-tool store --label=finSync id 1-66j... title finSync <project-id-661....json
endo eval "'${SHEET1_ID}'" -n finsync-id
1-66jE...
endo eval "E(secrets).makePassKey({ title: 'finSync', id })" -n fin-sync-creds secrets:desktop-secrets id:finsync-id
Object [Alleged: PassKey] {}

++ make endo plugin for Google Sheets
endo make --UNSAFE src/sheetsTool.js -n gsheets
Object [Alleged: SheetsTool] {}
++ Load a spreadsheet based on item from desktop secret store.
endo eval "E(gsheets).load(item)" -n finsync gsheets item:fin-sync-creds
Object [Alleged: SpreadsheetWr] {}

++ Push GnuCash transation ids to Sheetsync
endo eval "E(synctool).pushTxIds(sc, gc)" synctool gc:gcdb sc:finsync
532
```

## Toward weblet UI

Currently, we have a hello world:

```sh
endo open hello ./src/pg1.js --powers HOST
```

The `--powers HOST` results in providing an `EndoHost` (ref
[endo daemon types](https://github.com/endojs/endo/blob/endo/packages/daemon/src/types.d.ts)) to `make` in `pg1.js`.

## DB Hub Plugin API example

Look up the accounts table -- only the rows where name is Highlander:

```
$ endo eval "E(db).lookup('accounts', 'name', 'Highlander')" db:gcdb
Object [Alleged: TableRdWr] {}
```

Get a read-only facet of the accounts table:

```
$ endo eval "E(E(db).lookup('accounts')).readOnly()" db:gcdb
Object [Alleged: TableRd] {}
```

Pick out this one row of the accounts table; call it `caracct`:

```
$ endo eval "E(E(db).lookup('accounts', 'name', 'Highlander')).select1()" -n caracct db:gcdb
Object [Alleged: Row] {}
```

Get the contents with `endo eval "E(acct).get()" acct:caracct`:

```js
{
account_type: 'ASSET',
code: '1520-2003-ta',
description: 'Toyota Highlander',
guid: '2cecb1cf630e43560470044ec11ecb4e',
name: 'Highlander',
}
```

## Google Sheets Plugin API example

Pick out a worksheet by title:

```
$ endo eval "E(finsync).getSheetByTitle('Accounts')" finsync -n acctsheet
Object [Alleged: WorksheetRd] {}
```

Fetch some data:

```
connolly@bldbox:~/projects/finquick/packages/fincaps$ endo eval "E(acctsheet).getRows(0, 2)" acctsheet
[
  { 'A/L': 'Asset', Account:  'SAVINGS', Group: 'Bank Accounts', code: '1030' },
  { 'A/L': 'Asset', Account: 'CHECKING', Group: 'Bank Accounts', code: '1020' },
]
```

## Refs

- [feat\(daemon\): Weblets by kriskowal · Pull Request \#1658 · endojs/endo](https://github.com/endojs/endo/pull/1658)

based on [endo](https://github.com/endojs/endo/tree/endo) branch plus 1 patch. currently:

- 2023-08-17 16:31 `3918dccd7` refactor(daemon): Relax some pet name constraints
- 2023-08-27 15:20 `c2b39056c` chore(daemon): endow worker with console
