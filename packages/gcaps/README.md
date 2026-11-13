# gcaps - webkeys for narrow views of Google data

Gmail's narrowest OAuth scope, `gmail.readonly`, reads the whole
mailbox. To let an agent (or anyone) see some threads and nothing more,
the narrowing has to happen in code. Here it happens inside Google: an
Apps Script web app runs as you and holds the Gmail authority, and each
**webkey** it hands out names one row of the **Webkeys** sheet:

```
https://script.google.com/macros/s/<deployment>/exec#s=<swiss number>
```

A row's webkey shows the threads its Gmail query finds, and their
messages as raw RFC 822 (`.eml`). Editing the query steers what the
webkey sees without minting a new one; to keep a webkey to mail you've
picked out, put a label in its query (`label:agent roof claim`). See
`src/gcaps.js` for the design.

Who holds what:

- **The script** holds Gmail read-only (its manifest asks for no more),
  plus Sheets and the spreadsheet's menu UI.
- **The spreadsheet's editors** can mint webkeys, revoke them, and
  change what they find. Edit access is minting authority: keep the
  spreadsheet unshared.
- **A webkey's holder** can list what its query shows and fetch those
  messages. Nothing else; not the sheet, not other webkeys.

## Set up

With `clasp login` done (it's in the repo's devDependencies):

1. `make create`: a new spreadsheet, **Agent webkeys**, with this script
   bound to it.
2. `make push`, then in the script editor run `onOpen` once and grant
   the permissions it asks for.
3. `make deploy`. Note the deployment id; later deploys need it
   (`make deploy DEPLOYMENT_ID=AKf...`) to keep the URL that webkeys carry.
4. In the script editor's Project Settings, add script property
   `webAppUrl`: the deployment's `/exec` URL,
   `https://script.google.com/macros/s/<deployment id>/exec` (on Google
   Workspace, `.../a/<domain>/macros/s/...`). Minting won't guess it:
   `ScriptApp.getService().getUrl()` can name another deployment.

## Mint a webkey

The Webkeys sheet has columns `id`, `query`, `note`, `created` (in any
order, below a header row). The first **Webkeys > Mint webkey for
selected row** makes the sheet if it's missing.

1. In a new row, put a Gmail query, e.g. `label:agent roof claim`, and a
   note, e.g. `for Claude: hail roof`.
2. Select the row and pick **Webkeys > Mint webkey for selected row**.
   The row gets an `id` (the SHA-256 of the webkey's secret) and a
   `created` time. Copy the webkey from the dialog; it isn't shown again.
3. To revoke it, delete the row, or clear its `id` (then you can mint
   the row again, for a new webkey). Clearing the query also stops it.

Minting also sets script property `spreadsheet` to this spreadsheet's
id; that's how the web app finds the sheet. Until the first mint, the
web app's replies aren't JSON.

## Use it

- In a browser, the webkey shows the threads, with an `.eml` button per
  message.
- `make cache WEBKEY=<file> OUT=<dir>` saves each message once as
  `<date>-<subject>-<id>.eml`, and the query's results as `threads.json`.
  Keep the webkey file mode 0600.

`make test` runs the story with node's test runner.
