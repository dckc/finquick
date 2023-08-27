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

## Secret Tool

Usage example:

Store a secret as usual under the properties size 3, color blue:

```
$ secret-tool store --label='fun-fun' size 3 color blue
Password:
```

Instantiate this plugin:

```
$ endo make -n desktop-secrets --UNSAFE ./src/secret-tool.js
Object [Alleged: SecretTool] {}
```

Make a passkey for all blue things:

```
$ endo eval "E(tool).makePassKey({color:'blue'})" -n kblue tool:desktop-secrets
Object [Alleged: PassKey] {}
```

What properties does it have again?

```
$ endo eval "E(key).properties()" key:kblue
{ color: 'blue' }
```

Make a subkey for only size 3 blue things:

```
$ endo eval "E(key).subKey({size: 3})" key:kblue -n kb3
Object [Alleged: PassKey] {}
```

Get the size 3, color blue secret:

```
$ endo eval "E(key).get()" key:kb3
sekret
```

## DB Hub

Make a database hub that can look up sqlite3 databases by full path:

```
$ endo make -n hub1 --UNSAFE ./src/dbTool.js
Object [Alleged: DBHub] {}
```

Choose a sqlite3 database file path; for example, a GnuCash database:

```
$ endo eval "'/home/me/finance.gnucash'" -n p1
/home/me/finance.gnucash
```

Look up the GnuCash database an call it `gcdb`:

```
$ endo eval "E(hub).lookup(path)" hub:hub1 path:p1 -n gcdb
Object [Alleged: DBTool] {}
```

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

## Google Sheets

Load the plugin as, say, `gsheets`:

```
$ endo make --UNSAFE src/sheetsTool.js -n gsheets
Object [Alleged: SheetsTool] {}
```

Put the service account details in a secret store item with `id` of the spreadsheet:

```
$ secret-tool store --label='myGSheet' id 1-66j... title mySheet  <project-id-661....json
```

Using the Secret Store plugin above, give this item a petname of, say, `sheet-creds`:

```
$ endo eval "E(secrets).makePassKey({title: 'finSync', id:'1-66j...' })" -n sheet-creds secrets:desktop-secrets
```

Now load the spreadsheet info:

```
$ endo eval "E(gsheets).load(item)" -n finsync gsheets item:sheet-creds
Object [Alleged: SpreadsheetWr] {}
```

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

based on [endo](https://github.com/endojs/endo/tree/endo) branch. currently:

- 2023-08-17 16:31 `3918dccd7` refactor(daemon): Relax some pet name constraints
