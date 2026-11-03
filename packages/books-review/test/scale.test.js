/**
 * @file The books vats at a size like a real book's: a synthetic dump of
 * many transactions, some of them uncategorized, loads and lists its
 * uncategorized splits, with their precedents, in a few seconds.
 */
import { execFile, spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { connect, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import { E } from '@endo/far';
import { connectKernel } from '@vattr/toybox/kernel-client.js';
import { makeGit } from '@vattr/toybox/test/git.js';
import { makeToyboxes } from '@vattr/toybox/test/toybox.js';
import { makeWorkerd } from '@vattr/toybox/workerd-process.js';
import workerdPackage from 'workerd';
import WebSocket from 'ws';
import { here } from '../scripts/boot-dir.js';

// this test is the edge: it holds Node's I/O, and the clock it times with
const run = promisify(execFile);
const { freePort, startWorkerd } = makeWorkerd({
  workerd: workerdPackage.default,
  spawn,
  rm,
  connect,
  createServer,
  sleep,
});
const { startToybox } = makeToyboxes({ startWorkerd, freePort, mkdir });
const { makeRepo } = makeGit({
  run,
  cp,
  makeScratchDir: () => mkdtemp(join(tmpdir(), 'books-scale-repo-')),
});

/** How many transactions, and how many of them uncategorized. */
const TRANSACTIONS = 20000;
const UNCATEGORIZED = 500;
/** Descriptions repeat, as a merchant's do. */
const DESCRIPTIONS = 400;

/** @param {number} n @param {string} prefix */
const guid = (n, prefix) =>
  `${prefix}${String(n).padStart(31, '0')}`.slice(0, 32);

/**
 * The fixture's dump, with its transactions and splits replaced by
 * `TRANSACTIONS` synthetic ones: each from Checking to Groceries, or, for
 * the last `UNCATEGORIZED`, to Imbalance-USD.
 *
 * @param {string} dest
 */
const syntheticDump = async dest => {
  await cp(join(here, 'test', 'books', 'dump'), dest, { recursive: true });
  const checking = 'a0000000000000000000000000000002';
  const groceries = 'a0000000000000000000000000000008';
  const imbalance = 'a000000000000000000000000000000a';
  const usd = 'c7577e521c7f4f8dbf8e6a4ac2063429';
  const txs = [];
  const splits = [];
  for (let i = 0; i < TRANSACTIONS; i += 1) {
    const tx = guid(i, '7');
    const day = new Date(Date.UTC(2000, 0, 1) + i * 3600_000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
    txs.push([tx, usd, '', day, day, `MERCHANT ${i % DESCRIPTIONS}`]);
    const to = i >= TRANSACTIONS - UNCATEGORIZED ? imbalance : groceries;
    const value = 100 + (i % 9000);
    for (const [k, account, v] of /** @type {const} */ ([
      [1, checking, -value],
      [2, to, value],
    ]))
      splits.push([
        guid(i * 2 + k, '5'),
        tx,
        account,
        '',
        '',
        'n',
        '1970-01-01 00:00:00',
        v,
        100,
        v,
        100,
        null,
      ]);
  }
  /** @param {unknown[][]} rows */
  const ndjson = rows => rows.map(r => JSON.stringify(r)).join('\n') + '\n';
  await writeFile(join(dest, 'transactions.ndjson'), ndjson(txs));
  await writeFile(join(dest, 'splits.ndjson'), ndjson(splits));
};

test(`a book of ${TRANSACTIONS} transactions loads, and lists its ${UNCATEGORIZED} uncategorized splits with precedents, in seconds`, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'books-scale-'));
  const box = await startToybox(dir);
  const k = await connectKernel(
    new WebSocket(`ws+unix:${box.sock}:/kernel/scale`),
  );
  try {
    const dump = join(dir, 'dump');
    await syntheticDump(dump);
    const { tree: id, listing } = await makeRepo(
      dump,
      'book',
      join(dir, 'worktree'),
    );
    const tree = await E(await k.makeGitWorktree()).getTree(id, listing);
    const { root } = await k.createVat(
      await readFile(join(here, 'boot', 'books.js'), 'utf8'),
      { tree },
    );
    const start = Date.now();
    await E(root).load('book');
    const loaded = Date.now() - start;
    const view = await E(root).getView();
    const todo = await E(view).uncategorized();
    assert.equal(todo.length, UNCATEGORIZED);
    // what a categorizer asks of each: its precedents
    for (const { description } of todo) await E(view).precedents(description);
    const listed = Date.now() - start - loaded;
    assert.deepEqual(await E(view).precedents('MERCHANT 7'), [
      {
        account: 'Expenses:Groceries',
        count: TRANSACTIONS / DESCRIPTIONS - 1,
        last: (await E(view).precedents('MERCHANT 7'))[0].last,
      },
    ]);
    assert.ok(loaded < 20_000, `load took ${loaded} ms`);
    assert.ok(listed < 20_000, `listing took ${listed} ms`);
  } finally {
    k.close();
    await box.server.stop();
    await rm(dir, { recursive: true, force: true });
  }
});
