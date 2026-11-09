# books-review

An AI proposes where a GnuCash book's uncategorized transactions go, and you review each proposal before anything moves. The AI can read the book and propose, nothing more; only your verdicts move a split, and every move goes in a changelog you replay on the real book when you're ready.

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
3. Open the book's review page, ask the model for proposals, and accept, correct, or reject each, saying why if you like. Your reasons go into the lessons, which the model sees next time.
4. Download the changelog, close GnuCash, and replay it on the book:
   ```sh
   yarn apply BOOK.gnucash changelog.json
   ```

`systemctl --user stop books-review` stops it; its state stays in `~/.local/state/books-review`.

## Where you were, from your phone

Some purchases only make sense once you know where you were: whose errand it was, or whether that "market" was a restaurant. The boot page links to a timeline page to open on your phone, and install as an app if you like:

1. Let your phone reach the app socket over HTTPS, which installing needs. On a [tailnet](https://tailscale.com/kb/1312/serve), for example:
   ```sh
   tailscale serve --bg --https=8443 http://127.0.0.1:2578
   ```
   Then open the boot page at `https://HOST.TAILNET.ts.net:8443/` with its key, and send the Timeline link from there to your phone.
2. On the phone, export your timeline (Settings → Location → Timeline → Export timeline data).
3. On the timeline page, pick a start date and the export (from Downloads, say), and send.

The phone reads the export itself and sends only when, which place, and where for each visit since that date, none at home or work. The visits are kept until the service restarts; send them again after that. They aren't shown beside the splits yet.

## Who can do what

Each snapshot gets three vats, and each holds only its part:

- **books** loads the snapshot, all of it or none, and hands out a view of the book and a mover. The mover can move a split only out of an Imbalance account (by account code, `9001`) and only into an income or expense account, and logs each move.
- **reviewer** holds proposals and your verdicts. Only it holds the mover.
- **categorizer** is the AI's: it reads the book, and proposes through the reviewer's proposal box. It reaches the model only through a WebApp narrowed to the model's URL, handed to it for each run.

A **lessons** vat keeps your verdicts across snapshots, so what you taught about a description carries over to the next one. A **whereabouts** vat keeps the visits your phone sends: when, which place, and where, nothing more.

Design, layout, and tests: [CONTRIBUTING.md](CONTRIBUTING.md).
