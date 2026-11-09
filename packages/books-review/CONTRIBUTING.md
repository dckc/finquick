# Contributing to books-review

## Testing

```sh
yarn test        # runs a real toybox: the boot vat serving its page
yarn typecheck   # tsc --checkJs
nix flake check  # the boot directory and the serve wrapper
```

## Layout

- [boot/](boot/): the boot directory a toybox runs, after SwingSet's bootstrap vat. The bundle `boot/` is the boot vat: [boot.js](boot/boot/boot.js) serves the pages in [site/](boot/boot/site/) on the app socket.
- [scripts/](scripts/): assembling the boot directory, and running it as a user service.
- `*.ts`: types for the JavaScript, which `tsc --checkJs` checks: what the boot vat calls of the toybox.

## Toybox

The kernel is [vattr97](https://github.com/dckc/vattr97)'s toybox (`packages/toybox`), a yarn dependency by git commit until it's published. A vat never imports it: `E`, `Far`, `M`, `zone`, and `db` come in as vat powers, and types are JSDoc `@import`s. The boot vat gets every kernel device; so far, it uses only the ingress.

The boot vat starts on the first request to the app socket.
