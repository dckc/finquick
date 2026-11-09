# books-review

Here an AI will propose where a GnuCash book's uncategorized transactions go, and you'll review each proposal before anything moves, as vats on a toybox kernel. So far, the boot vat serves a page.

## Getting started

With Node 22 or later, from a clone of finquick:

```sh
cd packages/books-review
corepack enable
yarn install
yarn service ~/qtrx
```

That runs the books as a systemd user service, `books-review`, and prints a link to open. `~/qtrx` (give your own) is the git worktree the book's snapshots will be read from.

`systemctl --user stop books-review` stops it; its state stays in `~/.local/state/books-review`.

Design, layout, and tests: [CONTRIBUTING.md](CONTRIBUTING.md).
