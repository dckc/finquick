# gc-sync1 - Categorize Splits from GnuCash UI

**STATUS: WIP**. see [finquick issue
#51](https://github.com/dckc/finquick/issues/51).

Provided GnuCash is configured as below, we add these menu items:

 - Push Uncat Txs - select uncategorized transactions and POST to a
   Google Sheet for categorization (_working_).
 - Pull Categories - GET categories and apply them (_not working_).

## Load GnuCash Menu Handlers

Following conventions for [loading a custom
report](https://wiki.gnucash.org/wiki/Custom_Reports#Loading_Your_Report),
put something like this in `~/.config/gnucash/config-user.scm`:

```scm
(load (gnc-build-userdata-path "sync-uncat.scm"))
```

Then symlink `~/.local/share/gnucash/sync-uncat.scm` and
`~/.local/share/gnucash/sync-uncat-lib.scm` to the code in this dir.

## Deploy Google Sheet web service

Add `../sync26/syncSvc.js` to your spreadsheet and [create a
deployment](https://developers.google.com/apps-script/concepts/deployments).
This produces a URL like `https://script.google.com/macros/s/as;ldkflsd...`.
Assign that to the `$FINSYNC` environment variable before starting `gnucash`.
