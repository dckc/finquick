/**
 * @file The books vats on a toybox: a books vat loads a dump once; and the
 * boot directory makes a books vat per snapshot, and serves a page about
 * each on the app socket.
 */
import { execFile, spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { connect, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import { E } from '@endo/far';
import { connectKernel } from '@vattr/toybox/src/kernel-client.js';
import { makeGit } from '@vattr/toybox/test/git.js';
import { makeToyboxes } from '@vattr/toybox/test/toybox.js';
import { makeWorkerd } from '@vattr/toybox/src/workerd-process.js';
import workerdPackage from 'workerd';
import WebSocket from 'ws';
import { here, makeBootDir, toyboxDir } from '../scripts/boot-dir.js';

/** @import { Remote } from '@vattr/toybox/src/types.ts' */

// this test is the edge: it holds Node's I/O, and gives each helper what it uses
const run = promisify(execFile);
const { freePort, startWorkerd } = makeWorkerd({
  workerd: workerdPackage.default,
  spawn,
  rm,
  connect,
  createServer,
  sleep,
  log: chunk => {
    // WORKERD_LOG=1 echoes workerd's stderr, for debugging
    if (process.env.WORKERD_LOG) process.stderr.write(chunk);
  },
});
const { startToybox } = makeToyboxes({ startWorkerd, freePort, mkdir });
const { makeRepo } = makeGit({
  run,
  cp,
  makeScratchDir: () => mkdtemp(join(tmpdir(), 'books-repo-')),
});
const bootDir = makeBootDir({ cp, mkdir, rm }, toyboxDir());

const { entries } = Object;

const BALANCES = {
  Checking: 201458,
  'Imbalance-USD': 10130,
  Visa: 30000,
  Groceries: 8412,
  Salary: -250000,
};

/** @type {string} */
let dir;
/** @type {Awaited<ReturnType<typeof startToybox>>} */
let box;
/** @type {Awaited<ReturnType<typeof connectKernel>>} */
let k;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'books-'));
  box = await startToybox(dir, {
    config: 'test/config-local.capnp',
    boot: await bootDir(join(dir, 'bootdir')),
  });
  k = await connectKernel(new WebSocket(`ws+unix:${box.sock}:/kernel/main`));
});

after(async () => {
  k?.close();
  await box?.server.stop();
  await rm(dir, { recursive: true, force: true });
});

/**
 * The fixture book in the toybox's checkout, under dm93finance/, plus
 * `extra` files: the tree id and listing of all of it.
 *
 * @param {Record<string, string>} [extra]
 */
const booksListing = async (extra = {}) => {
  const checkout = join(dir, 'checkout');
  for (const [path, text] of entries(extra)) {
    await mkdir(join(checkout, dirname(path)), { recursive: true });
    await writeFile(join(checkout, path), text);
  }
  return makeRepo(join(here, 'test', 'books', 'dump'), 'dm93finance', checkout);
};

/** @param {string} path @param {Record<string, unknown>} req */
const post = async (path, req) => {
  const resp = await fetch(`http://127.0.0.1:${box.appPort}${path}`, {
    method: 'POST',
    body: JSON.stringify(req),
  });
  const body = await resp.json();
  return { status: resp.status, body };
};

/** An API client with `key`. @param {string} key */
const apiWith =
  key =>
  /** @param {string} op @param {unknown[]} args */
  async (op, ...args) => {
    const { status, body } = await post('/api', { key, op, args });
    if (status !== 200) throw Error(body.error);
    return body;
  };

/** The boot vat's root, from the admin session, once the app socket has booted it. */
const bootRoot = async () => {
  await fetch(`http://127.0.0.1:${box.appPort}/`);
  const [boot] = await k.vats();
  return boot.root;
};

test("a books vat loads a sqlite-diffable dump from a git tree once, refusing tables and rows that don't belong", async () => {
  /** @param {string} name @param {string[]} columns @param {string} schema */
  const meta = (name, columns, schema) =>
    JSON.stringify({ name, columns, schema });
  const { tree: id, listing } = await booksListing({
    'clash/vatstore.metadata.json': meta(
      'vatstore',
      ['k', 'v'],
      'CREATE TABLE vatstore (k, v)',
    ),
    'sneaky/t.metadata.json': meta(
      't',
      ['a'],
      'CREATE TABLE t (a); DROP TABLE vatstore',
    ),
    'ragged/accounts.metadata.json': meta(
      'accounts',
      ['a'],
      'CREATE TABLE accounts (a)',
    ),
    'ragged/accounts.ndjson': '["fine"]\n["one", "too many"]\n',
  });
  // a kernel of its own: the books vat alone, made over the admin socket
  const solo = await connectKernel(
    new WebSocket(`ws+unix:${box.sock}:/kernel/solo`),
  );
  const tree = await E(await solo.makeDevice('gitTrees')).getTree(id, listing);
  const { adminNode, root } = await solo.createVat(
    await readFile(join(here, 'boot', 'books.js'), 'utf8'),
    { tree },
  );
  await assert.rejects(E(root).load('clash'), /may not be named "vatstore"/);
  await assert.rejects(
    E(root).load('sneaky'),
    /must be one CREATE TABLE t statement/,
  );
  // a refused row leaves no table: dm93finance's accounts loads below
  await assert.rejects(E(root).load('ragged'), /row 2: not 1 strings/);

  const loaded = await E(root).load('dm93finance');
  assert.ok(loaded.includes('splits') && !loaded.includes('sqlite_sequence'));
  const rows = await E(root).tables();
  assert.deepEqual(
    [rows.accounts, rows.transactions, rows.splits, rows.slots, rows.vendors],
    [13, 6, 12, 3, 0],
  );
  assert.deepEqual(await E(root).balances(), BALANCES);

  await E(adminNode).restart();
  assert.deepEqual(await E(root).balances(), BALANCES);
  await assert.rejects(E(root).load('dm93finance'), /already loaded/);
  solo.close();
});

test('the boot vat makes a books vat per snapshot, and serves a page about each, with a key that opens only it', async () => {
  const boot = await bootRoot();
  const owner = apiWith((await E(boot).ownerLink()).slice(1));
  for (const path of [
    '/',
    '/boot.js',
    '/review',
    '/review.js',
    '/prelude.js',
    '/style.css',
  ]) {
    const resp = await fetch(`http://127.0.0.1:${box.appPort}${path}`);
    assert.equal(resp.status, 200, path);
  }
  assert.deepEqual(await post('/api', { key: 'guess', op: 'reviews' }), {
    status: 403,
    body: { error: 'that key opens nothing here' },
  });

  const { tree, listing } = await booksListing();
  // a load that failed can be tried again
  await assert.rejects(owner('load', listing, 'no-such-dir'), /no dump/);
  // pasted without -z, as git ls-tree -r prints it
  const made = await owner(
    'load',
    listing.replaceAll('\0', '\n'),
    'dm93finance',
  );
  assert.equal(made.tree, tree);
  assert.deepEqual(
    (await owner('load', listing, 'dm93finance')).reviewerKey,
    made.reviewerKey,
  );
  const me = apiWith(made.reviewerKey);
  await assert.rejects(me('load', listing, 'dm93finance'), /load/);

  // the review page reads the book's uncategorized splits, and that's all
  /** @type {import('../types.ts').Split[]} */
  const splits = await me('uncategorized');
  assert.deepEqual(
    splits.map(({ date, description, amount, against }) => [
      date,
      description,
      amount,
      against.map(a => `${a.name} ${a.type}`),
    ]),
    [
      ['2026-09-10', 'CORNER GROCERY', 61.3, ['Assets:Checking BANK']],
      ['2026-09-12', 'CITY WATER', 40, ['Assets:Checking BANK']],
      ['2026-09-15', 'VISA PAYMENT', 300, ['Assets:Checking BANK']],
      ['2026-09-16', 'PAYMENT THANK YOU', -300, ['Liabilities:Visa CREDIT']],
    ],
  );
  assert.deepEqual(await me('summary'), {
    count: 4,
    first: '2026-09-10',
    last: '2026-09-16',
  });
  const [review] = await E(boot).reviews();
  assert.deepEqual(await E(review.vats.books.root).balances(), BALANCES);

  // a crash of the whole toybox: everything is still there
  k.close();
  await box.server.stop();
  box = await startToybox(dir, {
    config: 'test/config-local.capnp',
    boot: join(dir, 'bootdir'),
  });
  k = await connectKernel(new WebSocket(`ws+unix:${box.sock}:/kernel/main`));
  assert.equal((await me('uncategorized')).length, 4);

  // a later snapshot gets vats of its own
  const later = await booksListing({ 'later.txt': 'a later snapshot' });
  const next = await owner('load', later.listing, 'dm93finance');
  assert.notEqual(next.tree, tree);
  assert.notEqual(next.reviewerKey, made.reviewerKey);
  assert.equal((await E(await bootRoot()).reviews()).length, 2);
  assert.equal((await owner('reviews')).length, 2);
});
