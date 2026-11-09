# Contributing to books-review

## Testing

```sh
yarn test        # runs real toyboxes: the books vat, the whole flow through the app socket, and a synthetic book of 20,000 transactions
yarn typecheck   # tsc --checkJs
nix flake check  # the boot directory and the serve wrapper
```

The tests need `git` on the PATH.

## Layout

- [boot/](boot/): the boot directory a toybox runs, after SwingSet's bootstrap vat. The bundle `boot/` is the boot vat: [boot.js](boot/boot/boot.js) wires the vats together and serves the pages in [site/](boot/boot/site/) on the app socket. The browser's scripts there are `.js.txt`, since a bundle's `.js` files are its own modules. The files beside the bundle are the vats it makes: a books vat per snapshot.
- [scripts/](scripts/): assembling the boot directory, and running it as a user service.
- `*.ts`: types for the JavaScript, which `tsc --checkJs` checks: what the vats pass around, and what they call of the toybox.

## Toybox

The kernel is [vattr97](https://github.com/dckc/vattr97)'s toybox (`packages/toybox`), a yarn dependency by git commit until it's published. A vat never imports it: `E`, `Far`, `M`, `zone`, and `db` come in as vat powers, and types are JSDoc `@import`s. The boot vat gets every kernel device; it hands each books vat only its snapshot's tree.

The boot vat starts on the first request to the app socket. On each start, it upgrades any vat whose code in the boot directory changed, so restarting the service with new code upgrades the vats in place; their durable objects stay.

## Webkeys

A webkey designates an object, whose interface guard is all it opens; the registry maps each key to its object, after E's SwissTable and [Waterken's web-keys](https://waterken.sourceforge.net/web-key/), so `/api` is `deref(key)` and a method call. The boot page's key designates the owner: loading snapshots. Each reviewer key designates a review page: the book's uncategorized splits, through its view. A page reads its key from the link's fragment once, keeps it in localStorage, and takes it out of the address bar. The app socket's origin is the boot vat's own, so no other vat's page can read them.
