/**
 * @file The books on a toybox: the boot vat serves its page on the app
 * socket.
 */
import { spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { connect, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { makeToyboxes } from '@vattr/toybox/test/toybox.js';
import { makeWorkerd } from '@vattr/toybox/src/workerd-process.js';
import workerdPackage from 'workerd';
import { makeBootDir, toyboxDir } from '../scripts/boot-dir.js';

// this test is the edge: it holds Node's I/O, and gives each helper what it uses
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
const bootDir = makeBootDir({ cp, mkdir, rm }, toyboxDir());

/** @type {string} */
let dir;
/** @type {Awaited<ReturnType<typeof startToybox>>} */
let box;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'books-'));
  box = await startToybox(dir, {
    config: 'test/config-local.capnp',
    boot: await bootDir(join(dir, 'bootdir')),
  });
});

after(async () => {
  await box?.server.stop();
  await rm(dir, { recursive: true, force: true });
});

test('the boot vat serves its page on the app socket', async () => {
  /** @param {string} path */
  const get = path => fetch(`http://127.0.0.1:${box.appPort}${path}`);
  const page = await get('/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type') ?? '', /^text\/html/);
  assert.match(await page.text(), /<h1>Books<\/h1>/);
  assert.equal((await get('/style.css')).status, 200);
  assert.equal((await get('/nope')).status, 404);
});
