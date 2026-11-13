# Contributing to gc-sync1

## Testing

Each menu item comes in two parts:

- `*-lib.scm` decides what to change. It uses only guile's own modules
  (`srfi`, `ice-9`) and gets splits and transactions as opaque handles.
- The handler (`clean-desc.scm`, `amazon-match.scm`, ...) holds the book:
  it finds the splits, asks before changing anything, and makes the changes.

So most of the logic can be tested without GnuCash.

### `make test`: the libraries, with any guile 3

```
make test
```

runs `clean-desc-test.scm` and `amazon-match-test.scm` (srfi-64) with
plain `guile`; no GnuCash libraries needed. Each test file tells a story
with made-up data, and later tests build on earlier ones. Keep real
purchases and payees out of them.

### `make check`: sync-uncat-lib, with GnuCash's libraries

`sync-uncat-lib.scm` uses GnuCash modules, so `make check` runs it with
GnuCash's shared libraries and guile site dir (`SO_LIBS`, `SITE_GUILE`
in the `Makefile`; adjust for your system).

### Trying a handler on a copy of the book

`make test` doesn't reach the handlers. To run one against real data
without touching the real book, have `gnucash-cli` run a throwaway report
whose renderer calls the handler's functions, on a copy:

```sh
S=$(mktemp -d); mkdir $S/cfg
# a consistent copy, even while GnuCash has the book open
sqlite3 "file:$HOME/path/to/books.gnucash?mode=ro" ".backup $S/book.gnucash"
sqlite3 $S/book.gnucash "delete from gnclock"  # the copy isn't open anywhere

# config-user.scm goes at the root of GNC_CONFIG_HOME, not in gnucash/
cat > $S/cfg/config-user.scm <<'EOF'
(use-modules (gnucash core-utils) (gnucash engine) (gnucash app-utils)
             (gnucash gnome-utils) (gnucash report))
(load (gnc-build-userdata-path "clean-desc.scm"))
(gnc:define-report
 'version 1 'name "Try Clean Descriptions"
 'report-guid "6c1f3b0e2a7d4e0f9b1a5c3d2e4f6a70" ; any fresh one
 'options-generator gnc:new-options
 'renderer
 (lambda (rpt)
   (let* ((txns (uncat-transactions (gnc-get-current-root-account)))
          (changes (description-changes txns #:description-of xaccTransGetDescription)))
     (format #t "~%=== PREVIEW~%~a~%=== END~%" (preview changes (length txns))))
   (gnc:make-html-document)))
EOF

# GNC_DATA_HOME=$PWD: gnc-build-userdata-path loads this checkout's files
GNC_CONFIG_HOME=$S/cfg GNC_DATA_HOME=$PWD GUILE_AUTO_COMPILE=0 \
  gnucash-cli --report run --name "Try Clean Descriptions" $S/book.gnucash 2>&1 |
  sed -n '/=== PREVIEW/,/=== END/p'
```

Notes:

- What the renderer prints arrives mixed with GnuCash's log and the
  report's (empty) HTML, so mark it and filter.
- To try a change, call the handler's setter (e.g. `set-description!`)
  in the renderer; the copy is saved. Check it with `sqlite3`.
- A warning like `compilation failed: no code for module (amazon-match-lib)`
  is harmless: the handler `load`s the library, so it's there by the
  time it's used.
- Plain `guile` can't do this: opening a book takes GnuCash's session
  code, which only `gnucash-cli` (or GnuCash) sets up.
