/**
 * @file The books vats on a toybox: a books vat loads a dump once; the boot
 * directory makes a books, reviewer, and categorizer per snapshot and serves
 * pages on the app socket; the categorizer asks a model for proposals; and
 * the timeline page uploads visits to the whereabouts vat.
 */
import { execFile, spawn } from 'node:child_process';
import { createServer as createHttpServer } from 'node:http';
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
import { CHANGELOG } from './books/changelog.js';
import { checkVisits, visitsAround } from '../boot/whereabouts.js';

/** @import { Remote } from '@vattr/toybox/src/types.ts' */

// this test is the edge: it holds Node's I/O, and gives each helper what it uses
const run = promisify(execFile);
/** What workerd wrote to stderr: console.warn from the vats among it. */
const logged = [''];
const { freePort, startWorkerd } = makeWorkerd({
  workerd: workerdPackage.default,
  spawn,
  rm,
  connect,
  createServer,
  sleep,
  log: chunk => {
    logged[0] += chunk;
    // WORKERD_LOG=1 echoes it, for debugging
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

const { entries, fromEntries } = Object;

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

test('the boot vat makes vats per snapshot and serves pages; the categorizer proposes, the reviewer decides, the book logs the moves, and lessons carry over', async () => {
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

  // the test plays the AI, holding only the categorizer
  const [review] = await E(boot).reviews();
  const ai = review.vats.categorizer.root;
  const guid = fromEntries(
    (await E(ai).accounts()).map(
      (/** @type {{ guid: string, name: string }} */ { guid, name }) => [
        name,
        guid,
      ],
    ),
  );
  assert.deepEqual(Object.keys(guid).sort(), [
    'Expenses:Groceries',
    'Expenses:Utilities',
    'Income:Salary',
  ]);
  /** @type {import('../types.ts').Todo[]} */
  const todo = await E(ai).uncategorized();
  assert.deepEqual(
    todo.map(({ date, description, amount, against }) => [
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
  // context: where this description went before in the book; nothing taught yet
  assert.deepEqual(todo[0].precedents, [
    { account: 'Expenses:Groceries', count: 1, last: '2026-09-03' },
  ]);
  assert.deepEqual([todo[0].lessons, todo[1].precedents], [[], []]);
  const [grocery, water, visaPayment, thanks] = todo.map(t => t.split);
  const p1 = await E(ai).propose(
    grocery,
    guid['Expenses:Groceries'],
    'CORNER GROCERY went to Groceries on 2026-09-03',
  );
  const p2 = await E(ai).propose(water, guid['Expenses:Groceries'], 'a guess');
  await assert.rejects(
    E(ai).propose(grocery, guid['Expenses:Utilities'], 'again'),
    /already has proposal/,
  );
  await assert.rejects(
    E(ai).propose(
      visaPayment,
      'a0000000000000000000000000000004',
      'a transfer',
    ),
    /not an income or expense account/,
  );
  // a hidden account isn't a category, though it's an expense account
  await assert.rejects(
    E(ai).propose(water, 'a000000000000000000000000000000b', 'my old hobby'),
    /not an income or expense account/,
  );
  await assert.rejects(
    E(ai).propose(
      '50000000000000000000000000000031',
      guid['Expenses:Groceries'],
      'not mine to move',
    ),
    /not an uncategorized split/,
  );

  assert.deepEqual(
    (await me('pending')).map(
      (
        /** @type {{ n: number, account: string, support: unknown }} */ {
          n,
          account,
          support,
        },
      ) => [n, account, support],
    ),
    [
      // CORNER GROCERY went to Groceries the one time it came up before
      [p1, 'Expenses:Groceries', { count: 1, of: 1 }],
      [p2, 'Expenses:Groceries', { count: 0, of: 0 }],
    ],
  );
  await me('review', p1, 'accept');
  await me(
    'review',
    p2,
    { account: guid['Expenses:Utilities'] },
    'the water bill is a utility',
  );
  await assert.rejects(me('review', p1, 'reject'), /already accepted/);
  const p3 = await E(ai).propose(
    thanks,
    guid['Income:Salary'],
    'money came in',
  );
  await me(
    'review',
    p3,
    'reject',
    'a card payment: confirm from the statement first',
  );
  assert.deepEqual(await me('summary'), {
    pending: 0,
    rejected: 1,
    uncategorized: { count: 2, first: '2026-09-15', last: '2026-09-16' },
  });
  // the rejected split waits for a person: the model isn't asked about it again
  assert.deepEqual(
    (await E(ai).uncategorized()).map(
      (/** @type {{ split: string }} */ t) => t.split,
    ),
    [visaPayment],
  );
  assert.deepEqual(await E(review.vats.books.root).balances(), {
    ...BALANCES,
    Groceries: 8412 + 6130,
    Utilities: 4000,
    'Imbalance-USD': 0,
  });

  // a crash of the whole toybox: everything is still there
  k.close();
  await box.server.stop();
  box = await startToybox(dir, {
    config: 'test/config-local.capnp',
    boot: join(dir, 'bootdir'),
  });
  k = await connectKernel(new WebSocket(`ws+unix:${box.sock}:/kernel/main`));
  // the old session's references went with it: find the categorizer again
  const [again] = await E(await bootRoot()).reviews();
  assert.deepEqual(
    (await E(again.vats.categorizer.root).history()).map(
      (/** @type {import('../types.ts').Lesson} */ l) => [
        l.status,
        l.proposed,
        l.final,
        l.reason,
        l.note,
        l.book,
      ],
    ),
    [
      [
        'rejected',
        'Income:Salary',
        undefined,
        'money came in',
        'a card payment: confirm from the statement first',
        tree,
      ],
      [
        'corrected',
        'Expenses:Groceries',
        'Expenses:Utilities',
        'a guess',
        'the water bill is a utility',
        tree,
      ],
      [
        'accepted',
        'Expenses:Groceries',
        'Expenses:Groceries',
        'CORNER GROCERY went to Groceries on 2026-09-03',
        undefined,
        tree,
      ],
    ],
  );
  assert.deepEqual(await me('changelog'), CHANGELOG);

  // a later snapshot gets vats of its own, but what the reviewer taught carries over
  const later = await booksListing({ 'later.txt': 'a later snapshot' });
  const next = await owner('load', later.listing, 'dm93finance');
  assert.notEqual(next.tree, tree);
  const nextReview = (await E(await bootRoot()).reviews()).find(
    (/** @type {{ tree: string }} */ i) => i.tree === next.tree,
  );
  const [water2] = /** @type {import('../types.ts').Todo[]} */ (
    await E(nextReview.vats.categorizer.root).uncategorized()
  ).filter(t => t.description === 'CITY WATER');
  assert.deepEqual(
    water2.lessons.map(({ status, final, note }) => [status, final, note]),
    [['corrected', 'Expenses:Utilities', 'the water bill is a utility']],
  );
  assert.equal((await owner('reviews')).length, 2);
});

test('the categorizer asks a model for proposals, through a WebApp over the LAN device, with the API key in a header', async () => {
  /** @type {{ headers: import('node:http').IncomingHttpHeaders, body: any }[]} */
  const asked = [];
  /** @type {Record<string, string>} */
  let ids = {};
  const model = createHttpServer(async (req, res) => {
    let text = '';
    for await (const chunk of req) text += chunk;
    const body = JSON.parse(text);
    asked.push({ headers: req.headers, body });
    const { splits } = JSON.parse(body.messages[1].content);
    ids = fromEntries(
      splits.map((/** @type {{ id: string, description: string }} */ s) => [
        s.description,
        s.id,
      ]),
    );
    /** @param {Record<string, string | number>} args */
    const call = args => ({
      type: 'function',
      function: { name: 'propose', arguments: JSON.stringify(args) },
    });
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              role: 'assistant',
              tool_calls: [
                call({
                  split: ids['CITY WATER'],
                  account: 'Expenses:Utilities',
                  reason: 'water is a utility',
                  confidence: 0.9,
                }),
                call({
                  split: ids['VISA PAYMENT'],
                  account: 'Assets:Checking',
                  reason: 'a transfer',
                }),
              ],
            },
          },
        ],
      }),
    );
  });
  const port = await new Promise(resolve =>
    model.listen(0, '127.0.0.1', () =>
      resolve(
        /** @type {import('node:net').AddressInfo} */ (model.address()).port,
      ),
    ),
  );
  try {
    const boot = await bootRoot();
    const owner = apiWith((await E(boot).ownerLink()).slice(1));
    const { listing } = await booksListing({ 'model.txt': 'a third snapshot' });
    const made = await owner('load', listing, 'dm93finance');
    const me = apiWith(made.reviewerKey);
    await assert.rejects(me('categorize', 2), /no model is set up/);
    // and the journal says so too
    for (let i = 0; i < 50 && !logged[0].includes('books-api-failed'); i += 1)
      await sleep(20);
    assert.match(
      logged[0],
      /"event":"books-api-failed","op":"categorize","error":"no model is set up yet"/,
    );
    await owner(
      'setModel',
      `http://127.0.0.1:${port}/v1/`,
      'fake-model',
      'sekrit',
    );
    assert.deepEqual(await owner('model'), {
      url: `http://127.0.0.1:${port}/v1/`,
      name: 'fake-model',
    });

    const { proposed, refused } = await me('categorize', 3);
    assert.equal(asked.length, 1);
    assert.equal(asked[0].headers.authorization, 'Bearer sekrit');
    // an OpenAI-style server refuses a body it isn't told is JSON (422)
    assert.equal(asked[0].headers['content-type'], 'application/json');
    assert.equal(asked[0].body.model, 'fake-model');
    assert.equal(asked[0].body.tools[0].function.name, 'propose');
    assert.equal(Object.keys(ids).length, 3);
    assert.deepEqual(
      proposed.map((/** @type {{ split: string }} */ p) => p.split),
      [ids['CITY WATER']],
    );
    assert.match(refused[0].error, /not an income or expense account/);
    assert.deepEqual(
      (await me('pending')).map(
        (
          /** @type {{ description: string, account: string, reason: string }} */ p,
        ) => [p.description, p.account, p.reason],
      ),
      [['CITY WATER', 'Expenses:Utilities', 'water is a utility']],
    );
    assert.equal((await me('pending'))[0].confidence, 0.9);
    assert.equal(
      asked[0].body.tools[0].function.parameters.properties.confidence.type,
      'number',
    );
  } finally {
    model.close();
  }
});

/** Made-up visits, as a phone sends them. */
const VISITS = [
  {
    startTime: '2026-05-09T18:41:00.000-05:00',
    placeId: 'ChIJgrocer',
    latLng: '40.0001°, -95.0002°',
  },
  {
    startTime: '2026-05-09T12:24:00.000-05:00',
    placeId: 'ChIJcafe',
    latLng: '40.0003°, -95.0004°',
  },
  {
    startTime: '2026-05-14T10:19:00.000-05:00',
    placeId: 'ChIJpost',
    latLng: '40.0005°, -95.0006°',
  },
];

test('visits are checked, kept in time order, and found by the days before a posting date', () => {
  const visits = checkVisits(VISITS);
  assert.deepEqual(
    visits.map(v => v.placeId),
    ['ChIJcafe', 'ChIJgrocer', 'ChIJpost'],
  );
  // a card posts a day or two after the purchase
  assert.deepEqual(
    visitsAround(visits, '2026-05-10', 2).map(v => v.placeId),
    ['ChIJcafe', 'ChIJgrocer'],
  );
  assert.deepEqual(
    visitsAround(visits, '2026-05-14', 0).map(v => v.placeId),
    ['ChIJpost'],
  );
  assert.throws(
    () => checkVisits([{ ...VISITS[0], startTime: 'noon' }]),
    /isn't one/,
  );
});

test('the timeline page uploads visits to the whereabouts vat, with a key that opens nothing else', async () => {
  const owner = apiWith((await E(await bootRoot()).ownerLink()).slice(1));
  for (const path of [
    '/timeline/',
    '/timeline/app.js',
    '/timeline/sw.js',
    '/timeline/manifest.webmanifest',
    '/timeline/icon.svg',
  ]) {
    const resp = await fetch(`http://127.0.0.1:${box.appPort}${path}`);
    assert.equal(resp.status, 200, path);
  }
  const manifest = await (
    await fetch(`http://127.0.0.1:${box.appPort}/timeline/manifest.webmanifest`)
  ).json();
  assert.equal(manifest.scope, '/timeline/');
  const bare = await fetch(`http://127.0.0.1:${box.appPort}/timeline`, {
    redirect: 'manual',
  });
  assert.equal(bare.headers.get('location'), '/timeline/');

  const { key, count } = await owner('timeline');
  assert.equal(count, 0);
  const phone = apiWith(key);
  assert.deepEqual(await phone('put', VISITS), {
    count: 3,
    first: '2026-05-09T12:24:00.000-05:00',
    last: '2026-05-14T10:19:00.000-05:00',
  });
  assert.equal((await owner('timeline')).count, 3);
  // the whereabouts vat's interface guard: these fields, no more, no fewer
  await assert.rejects(
    phone('put', [{ ...VISITS[0], raw: [] }]),
    /Must not have unexpected properties: \["raw"\]/,
  );
  const { latLng: _, ...noWhere } = VISITS[0];
  await assert.rejects(
    phone('put', [noWhere]),
    /Must have missing properties \["latLng"\]/,
  );
  assert.equal(
    (await phone('summary')).count,
    3,
    'a refused upload keeps what was there',
  );
  await assert.rejects(phone('reviews'), /reviews/);
  // the phone uploads; it can't ask where you were
  await assert.rejects(phone('around', '2026-05-10'), /around/);

  // TODO(storage) in whereabouts.js: a restart forgets them
  k.close();
  await box.server.stop();
  box = await startToybox(dir, {
    config: 'test/config-local.capnp',
    boot: join(dir, 'bootdir'),
  });
  k = await connectKernel(new WebSocket(`ws+unix:${box.sock}:/kernel/main`));
  await bootRoot();
  assert.deepEqual(await phone('summary'), {
    count: 0,
    first: null,
    last: null,
  });
});
