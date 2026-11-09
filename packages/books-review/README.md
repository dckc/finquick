# books-review

An AI proposes where a GnuCash book's uncategorized transactions go, and a review page shows each proposal, with how far to trust it. The AI can read the book and propose, nothing more.

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
2. Set up the model: an OpenAI-style API's base URL (its `/v1/`), the model's name, and its key.
3. Open the book's review page, and ask the model for proposals. Each shows the model's reason, how sure it says it is, and how often the book's precedents agree.

`systemctl --user stop books-review` stops it; its state stays in `~/.local/state/books-review`.

## Who can do what

Each snapshot gets three vats, and each holds only its part:

- **books** loads the snapshot, all of it or none, and hands out a view of the book.
- **reviewer** holds the proposals.
- **categorizer** is the AI's: it reads the book, and proposes through the reviewer's proposal box. It reaches the model only through a WebApp narrowed to the model's URL, handed to it for each run.

Design, layout, and tests: [CONTRIBUTING.md](CONTRIBUTING.md).
