# books-review

Load a snapshot of a GnuCash book, and see its uncategorized transactions: those still in an Imbalance account. That's the start of having an AI propose where they go, for you to review.

## Getting started

With Node 22 or later, from a clone of finquick:

```sh
cd packages/books-review
corepack enable
yarn install
yarn service ~/qtrx
```

That runs the books as a systemd user service, `books-review`, reading snapshots of the book from the git worktree `~/qtrx` (give your own), and prints a link to open. On that page:

1. Load a snapshot: paste what `git ls-tree -r` lists for the commit's dump directory. For example, to put it on the clipboard:
   ```sh
   git -C ~/qtrx ls-tree -r HEAD dm93finance | xclip -selection clipboard
   ```
   The files are read from the worktree and must match what's listed, so list a commit whose dump you haven't edited since.
2. Open the book's review page: it lists the uncategorized splits, oldest first.

`systemctl --user stop books-review` stops it; its state stays in `~/.local/state/books-review`.

## Who can do what

Each snapshot gets a **books** vat, which loads the snapshot, all of it or none, and hands out a view of the book. Its review page reads that view, and nothing more.

Design, layout, and tests: [CONTRIBUTING.md](CONTRIBUTING.md).
