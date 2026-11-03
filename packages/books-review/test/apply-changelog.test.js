/** @file A books vat's changelog replays on a GnuCash file: all or nothing, and not while GnuCash has it open. */
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, test } from 'node:test';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import { applyChangelog } from '../scripts/apply-changelog.js';
import { here } from '../scripts/boot-dir.js';
import { CHANGELOG } from './books/changelog.js';

const run = promisify(execFile);
const lock = { host: 'test', pid: 1 };

/** @type {string} */
let dir;
/** @type {string} */
let bookSql;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'apply-changelog-'));
  bookSql = await readFile(join(here, 'test', 'books', 'book.sql'), 'utf8');
});

after(() => rm(dir, { recursive: true, force: true }));

/** A GnuCash file made from book.sql, then changed by `edit`. @param {string} name @param {(db: DatabaseSync) => void} [edit] */
const gnucash = (name, edit = () => {}) => {
  const path = join(dir, name);
  const db = new DatabaseSync(path);
  db.exec(bookSql);
  edit(db);
  db.close();
  return path;
};

/** Apply the changelog to the file at `path`. @param {string} path */
const apply = path => {
  const db = new DatabaseSync(path);
  try {
    return applyChangelog(db, CHANGELOG, lock);
  } finally {
    db.close();
  }
};

/** @param {string} a @param {string} b */
const sqldiff = async (a, b) => (await run('sqldiff', [a, b])).stdout.trim();

test('a changelog moves just its splits', async () => {
  const [before, after] = [gnucash('before.gnucash'), gnucash('after.gnucash')];
  assert.equal(apply(after), 2);
  // sqldiff names rows by rowid: the splits are the 6th and 8th that book.sql inserts
  assert.equal(
    await sqldiff(before, after),
    "UPDATE splits SET account_guid='a0000000000000000000000000000008' WHERE rowid=6;\nUPDATE splits SET account_guid='a0000000000000000000000000000009' WHERE rowid=8;",
  );
});

test('if any split moved since, none of the changelog applies', async () => {
  /** @param {DatabaseSync} db */
  const moved = db =>
    void db
      .prepare('UPDATE splits SET account_guid = ? WHERE guid = ?')
      .run('a0000000000000000000000000000008', CHANGELOG[1].guid);
  const [edited, copy] = [
    gnucash('edited.gnucash', moved),
    gnucash('copy.gnucash', moved),
  ];
  assert.throws(
    () => apply(edited),
    /split 50+42 is no longer in account a0+a; the book changed since/,
  );
  assert.equal(await sqldiff(copy, edited), '');
});

test('a book GnuCash has open is refused', async () => {
  /** @param {DatabaseSync} db */
  const locked = db =>
    void db.prepare("INSERT INTO gnclock VALUES ('bldbox', 4242)").run();
  const [open, copy] = [
    gnucash('open.gnucash', locked),
    gnucash('copy-open.gnucash', locked),
  ];
  assert.throws(() => apply(open), /is open in GnuCash \(bldbox, pid 4242\)/);
  assert.equal(await sqldiff(copy, open), '');
});
