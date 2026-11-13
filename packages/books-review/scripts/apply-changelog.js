#!/usr/bin/env node
/**
 * @file Replay a books vat's changelog on the GnuCash file its book came from.
 */
import { readFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

/** @import { Change } from '../types.ts' */

const HELP = `usage: scripts/apply-changelog.js BOOK.gnucash CHANGELOG.json

Replays the changelog a review page downloads on the GnuCash book its
snapshot came from. All or nothing: a change applies only if its split is
still in the account it was moved from, and if any isn't (the book was
edited since), none apply. The book must not be open in GnuCash: a row in
its gnclock refuses the whole changelog, and this tool holds a row of its
own while it works, as GnuCash does. Prints how many changes applied.
`;

const { freeze } = Object;

/** The changes this tool knows how to replay: moving a split to another account. @type {Readonly<Record<string, string[]>>} */
const REPLAYABLE = freeze({ splits: ['account_guid'] });

/**
 * Apply `changes` to the GnuCash book `db`; answers how many applied.
 *
 * @param {DatabaseSync} db
 * @param {Change[]} changes
 * @param {{ host: string, pid: number }} lock what to write in `gnclock` while working
 */
export const applyChangelog = (db, changes, lock) => {
  for (const c of changes) {
    if (!(REPLAYABLE[c.table] ?? []).includes(c.column))
      throw Error(`can't replay a change to ${c.table}.${c.column}`);
  }
  const [held] = db.prepare('SELECT Hostname, PID FROM gnclock').all();
  if (held)
    throw Error(
      `the book is open in GnuCash (${held.Hostname}, pid ${held.PID}); close it first`,
    );
  db.prepare('INSERT INTO gnclock VALUES (?, ?)').run(lock.host, lock.pid);
  try {
    const account = db.prepare('SELECT 1 FROM accounts WHERE guid = ?');
    const move = db.prepare(
      'UPDATE splits SET account_guid = ? WHERE guid = ? AND account_guid = ?',
    );
    db.exec('BEGIN');
    try {
      for (const c of changes) {
        if (!account.get(c.to)) throw Error(`no account ${c.to} in the book`);
        if (move.run(c.to, c.guid, c.from).changes !== 1)
          throw Error(
            `split ${c.guid} is no longer in account ${c.from}; the book changed since`,
          );
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } finally {
    db.prepare('DELETE FROM gnclock WHERE Hostname = ? AND PID = ?').run(
      lock.host,
      lock.pid,
    );
  }
  return changes.length;
};

/**
 * @param {object} [io] what main uses; Node's, by default
 * @param {string[]} [io.args]
 * @param {(text: string) => void} [io.print]
 * @param {(path: string) => DatabaseSync} [io.open]
 * @param {(path: string) => Promise<string>} [io.read]
 * @param {{ host: string, pid: number }} [io.lock]
 */
export const main = async ({
  args = process.argv.slice(2),
  print = text => void process.stdout.write(text),
  open = path => new DatabaseSync(path),
  read = path => readFile(path, 'utf8'),
  lock = { host: hostname(), pid: process.pid },
} = {}) => {
  if (args.length !== 2) return print(HELP);
  const [book, changelog] = args;
  const changes = JSON.parse(await read(changelog));
  const db = open(book);
  try {
    print(`applied ${applyChangelog(db, changes, lock)} changes to ${book}\n`);
  } finally {
    db.close();
  }
};

if (process.argv[1] === new URL(import.meta.url).pathname) await main();
