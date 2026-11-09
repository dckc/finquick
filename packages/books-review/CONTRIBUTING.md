# Contributing to books-review

## Testing

```sh
yarn test        # runs real toyboxes: the books vat, the whole flow through the app socket, the model loop, a synthetic book of 20,000 transactions, and the apply tool
yarn typecheck   # tsc --checkJs
nix flake check  # the boot directory, the apply tool, and the serve wrapper
```

The tests need `git` and `sqldiff` on the PATH.

## Layout

- [boot/](boot/): the boot directory a toybox runs, after SwingSet's bootstrap vat. The bundle `boot/` is the boot vat: [boot.js](boot/boot/boot.js) wires the vats together and serves the pages in [site/](boot/boot/site/) on the app socket. The browser's scripts there are `.js.txt`, since a bundle's `.js` files are its own modules. The files beside the bundle are the vats it makes: the books, a reviewer and a categorizer per snapshot, and the shared lessons and whereabouts.
- [scripts/](scripts/): assembling the boot directory (with the toybox vats it uses), running it as a user service, and replaying a changelog on a `.gnucash` file.
- `*.ts`: types for the JavaScript, which `tsc --checkJs` checks: what the vats pass around, and what they call of the toybox.

## Toybox

The kernel is [vattr97](https://github.com/dckc/vattr97)'s toybox (`packages/toybox`), a yarn dependency by git commit until it's published. A vat never imports it: `E`, `Far`, `M`, `zone`, and `db` come in as vat powers, and types are JSDoc `@import`s. Nor can a vat import another vat's modules, so `put(store, key, value)` (init or set) and `update(store, key, f)` (set to `f` of the old value, after the State monad's `put` and `modify`) are copied into each file that uses them, typed by `stores.ts`. Each vat makes its shapes from its `M`, and the types of what it passes around are inferred from them (`TypeFromPattern`, `TypeFromInterfaceGuard`), so a guard checks what its type says; `types.ts` re-exports them. A guard that passes on a record another vat's guard checked checks only its own fields, and a shape copied into another bundle is typechecked against the original with `Same`. The boot vat gets every kernel device; it hands the git worktree to the books' trees and the LAN device to the WebApp maker, so the model can be on the home network or the tailnet but nowhere else.

The boot vat starts on the first request to the app socket. On each start, it upgrades any vat whose code in the boot directory changed, so restarting the service with new code upgrades the vats in place; their durable objects stay.

## Webkeys

A webkey designates an object, whose interface guard is all it opens; the registry maps each key to its object, after E's SwissTable and [Waterken's web-keys](https://waterken.sourceforge.net/web-key/), so `/api` is `deref(key)` and a method call. The boot page's key designates the owner: loading snapshots and setting up the model. Each reviewer key designates a review page: the reviewer's queries and verdicts, and `categorize`, but not the proposal box. The timeline key designates the whereabouts vat's uploader, which can `put` visits and count them but not ask where you were. A page reads its key from the link's fragment once, keeps it in localStorage, and takes it out of the address bar. The app socket's origin is the boot vat's own, so no other vat's page can read them.

## The model loop

`categorize` sends one chat completion with a `propose` tool, and passes each call to the proposal box. Not yet:

- refusals sent back to the model as tool results, for another try;
- batches sized to the model's context;
- a run's progress kept durable, so a restart resumes it;
- retries and back-off on errors;
- a "retry rejected" toggle on the review page's Ask: today a split rejected in a snapshot isn't asked about again until the next snapshot.
