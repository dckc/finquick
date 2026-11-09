#!/bin/sh
# Run the books review as a transient systemd user service, `books-review`,
# and print the boot page's link.
#
# usage: scripts/service.sh [CHECKOUT [STATE_DIR [PORT]]]
#
# CHECKOUT is the git checkout holding the book's sqlite-diffable dump
# (~/qtrx by default); STATE_DIR keeps the kernel's state
# (~/.local/state/books-review); PORT is the app socket's (2578, BKRV for BooKs ReView on a phone keypad; the http socket takes the next). Each start
# assembles the boot directory afresh (scripts/boot-dir.js), so the vats are
# upgraded to this package's code. Stop it with
# `systemctl --user stop books-review`; the state stays.
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
checkout=${1:-$HOME/qtrx}
state=${2:-$HOME/.local/state/books-review}
port=${3:-2578}

node "$here/scripts/boot-dir.js" "$state/boot"
# sh: a package from git keeps no file modes
exec sh "$here/node_modules/@vattr/toybox/scripts/service.sh" books-review \
  "$state" "$state/boot" --checkout "$checkout" --port "$port"
