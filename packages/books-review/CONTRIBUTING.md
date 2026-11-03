# Contributing to books-review

## Testing

```sh
yarn test        # runs real toyboxes: the books vat, the whole flow through the app socket, the model loop, a synthetic book of 20,000 transactions, and the apply tool
yarn typecheck   # tsc --checkJs
nix flake check  # the boot directory, the apply tool, and the serve wrapper
```

The tests need `git` and `sqldiff` on the PATH.

## Layout

- [boot/](boot/): the boot directory a toybox runs, after SwingSet's bootstrap vat. The kernel starts `boot/` (a bundle of [boot.js](boot/boot/boot.js) and [pages.js](boot/boot/pages.js)); the boot vat makes the others from the files beside it:
  - [books.js](boot/books.js): loads a snapshot of the book from a git tree; its view and mover.
  - [reviewer.js](boot/reviewer.js): proposals, verdicts, and the proposal box.
  - [categorizer.js](boot/categorizer.js): the AI's part, and `categorize(limit, model, name)`, the model loop.
  - [lessons.js](boot/lessons.js): verdicts across snapshots, by normalized description.
- [scripts/boot-dir.js](scripts/boot-dir.js) assembles the boot directory: `boot/`, plus the toybox vats it uses (the WebApp maker), vendored from the toybox this package depends on. The flake does the same from its vattr97 input.
- [scripts/service.sh](scripts/service.sh) runs it as a transient user service; [scripts/apply-changelog.js](scripts/apply-changelog.js) replays a changelog on a `.gnucash` file.
- [types.ts](types.ts): the types the vats pass around; [toybox.d.ts](toybox.d.ts): the toybox modules the tests use.

## Toybox

The kernel is [vattr97](https://github.com/dckc/vattr97)'s toybox (`packages/toybox`), a yarn dependency by git commit until it's published. A vat never imports it: `E`, `Far`, `M`, `zone`, and `db` come in as vat powers, and types are JSDoc `@import`s. The boot vat gets every kernel device; it hands the git worktree to the books' trees and the LAN device to the WebApp maker, so the model can be on the home network or the tailnet but nowhere else.

The boot vat starts on the first request to the app socket. On each start, it upgrades any vat whose code in the boot directory changed, so restarting the service with new code upgrades the vats in place; their durable objects stay.

## Webkeys

The boot page's key opens loading snapshots and setting up the model; each book's reviewer key opens only its review page. A page reads its key from the link's fragment once, keeps it in localStorage, and takes it out of the address bar. The app socket's origin is the boot vat's own, so no other vat's page can read them.

## The model loop

`categorize` sends one chat completion with a `propose` tool, and passes each call to the proposal box. Not yet:

- refusals sent back to the model as tool results, for another try;
- batches sized to the model's context;
- a run's progress kept durable, so a restart resumes it;
- retries and back-off on errors;
- a "retry rejected" toggle on the review page's Ask: today a split rejected in a snapshot isn't asked about again until the next snapshot.
