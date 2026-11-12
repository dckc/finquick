# gc-sync1 - Categorize Splits from GnuCash UI

**STATUS: WIP**. see [finquick issue
#51](https://github.com/dckc/finquick/issues/51).

Provided GnuCash is configured as below, we add these items to a
**Reports > Finquick** submenu (GnuCash 5 puts every Scheme menu
extension under Reports; see `finquick-menu.scm`):

 - Push Uncat Txs - select uncategorized transactions and POST to a
   Google Sheet for categorization (_working_).
 - Pull Categories - GET categories and apply them (_not working_).
 - Clean Descriptions - strip payment-processor prefixes (`TST*`,
   `SQ *`, `DDA PUR `, ...) from uncategorized (Imbalance-USD)
   transactions, so sorting by description groups by merchant. It
   shows what would change and asks first. The prefixes are a list
   in `clean-desc-lib.scm`; `make test` checks it with plain guile.
 - Match Amazon Orders - set the memos of uncategorized Amazon charges
   to their orders' items and ids, from an order-history CSV (from
   the azad extension) that you pick with `zenity`'s file chooser
   (without zenity: `~/Downloads/amazon_order_history.csv`),
   matching by process of elimination; shows the report and asks
   first. It also sets each matched transaction's document link to
   its order's page. A port of qtrx `tools/amazon_match.py`; `make
   test` runs its story with plain guile.
 - Link Amazon Orders - set the document link of each transaction
   matched earlier (a memo naming an `orderId`) to its order's page,
   `https://www.amazon.com/your-orders/order-details?orderID=…`;
   leaves alone a transaction that already has a link or whose memos
   name more than one order; shows them and asks first.

## Load GnuCash Menu Handlers

Following conventions for [loading a custom
report](https://wiki.gnucash.org/wiki/Custom_Reports#Loading_Your_Report),
put something like this in `~/.config/gnucash/config-user.scm`:

```scm
(load (gnc-build-userdata-path "clean-desc.scm"))
(load (gnc-build-userdata-path "amazon-match.scm"))
(load (gnc-build-userdata-path "sync-uncat.scm"))
```

Then `make install` symlinks the `.scm` files in this dir into
`~/.local/share/gnucash/`, and restart GnuCash.

## Deploy Google Sheet web service

Add `../sync26/syncSvc.js` to your spreadsheet and [create a
deployment](https://developers.google.com/apps-script/concepts/deployments).
This produces a URL like `https://script.google.com/macros/s/as;ldkflsd...`.
Assign that to the `$FINSYNC` environment variable before starting `gnucash`.
