// gcaps.test.js -- run with: make test
// The story from gcaps.js: a roof claim, told with a made-up Webkeys sheet and mail.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { cacheMail, fileName, makeClient, parseWebkey } from '../scripts/mail-cache.js';

/**
 * Apps Script files share one global scope; run gcaps.js in a context of
 * its own, and get its makers. (A script's top-level consts aren't
 * properties of the context, so the script hands them back.)
 * @param {{ readFile: typeof readFile }} io
 */
const loadGcaps = async ({ readFile }) => {
  const src = await readFile(new URL('../src/gcaps.js', import.meta.url), 'utf8');
  return vm.runInNewContext(`${src}\n;({ makeCapTable_, makeMinter_, makeMailQuery_, invoke_ })`);
};

// plain objects of this realm, for deepEqual
const plain = x => JSON.parse(JSON.stringify(x));

// The owner's mailbox: two threads with the adjuster, labeled agent; the
// roofer's estimate, not labeled; and an order that has nothing to do with it.
const message = (id, threadId, date, from, subject) => ({ id, threadId, date, from, subject });
const mailbox = [
  message('a1', 't1', 'Tue, 2 Jun 2026 09:00:00 -0500', 'adjuster@acme-mutual.example', 'Claim 0042: inspection'),
  message('a2', 't1', 'Tue, 2 Jun 2026 10:15:00 -0500', 'dan@example.org', 'Re: Claim 0042: inspection'),
  message('b1', 't2', 'Mon, 6 Jul 2026 14:00:00 -0500', 'adjuster@acme-mutual.example', 'Claim 0042: payment issued'),
  message('c1', 't3', 'Fri, 29 May 2026 08:00:00 -0500', 'estimates@roofer.example', 'Your roof estimate'),
  message('d1', 't4', 'Sat, 11 Jul 2026 08:00:00 -0500', 'orders@shop.example', 'Bidet seat shipped'),
];
// what Gmail finds for each query, most recent thread first
const searches = { 'label:agent roof claim': ['t2', 't1'], roof: ['t2', 't1', 't3'] };

const fakeGmail = calls => ({
  Users: {
    Threads: {
      list: (_me, { q, maxResults }) => {
        calls.push(`search ${q}`);
        const ids = searches[q] || [];
        return {
          threads: ids.slice(0, maxResults).map(id => ({ id })),
          ...(ids.length > maxResults ? { nextPageToken: 'p2' } : {}),
        };
      },
      get: (_me, id) => ({
        id,
        messages: mailbox.filter(m => m.threadId === id).map(m => ({
          id: m.id,
          payload: { headers: [{ name: 'Date', value: m.date }, { name: 'From', value: m.from }, { name: 'Subject', value: m.subject }] },
        })),
      }),
    },
    Messages: {
      get: (_me, id) => {
        const m = mailbox.find(x => x.id === id);
        calls.push(`get ${id}`);
        return { id, threadId: m.threadId, raw: [...Buffer.from(`Subject: ${m.subject}\r\n\r\nhi\r\n`)] };
      },
    },
  },
});

// The Webkeys sheet, as the owner filled it in: a row for Claude, one
// for the owner, and one not ready yet.
const makeIO = () => {
  const grid = [
    ['id', 'query', 'note', 'created'],
    ['', 'label:agent roof claim', 'for Claude: hail roof', ''],
    ['', 'roof', 'mine', ''],
    ['', '', 'not ready yet', ''],
  ];
  const calls = [];
  let n = 0;
  return {
    grid,
    calls,
    sheet: {
      getDataRange: () => ({ getValues: () => grid.map(row => [...row]) }),
      getRange: (row, col) => ({ setValue: value => (grid[row - 1][col - 1] = value) }),
    },
    digest: s => [...createHash('sha256').update(s).digest()].map(b => (b > 127 ? b - 256 : b)), // signed, as in Java
    random: () => `swiss${(n += 1)}`,
    now: () => new Date('2026-11-13T20:00:00Z'),
    base64: bytes => Buffer.from(bytes).toString('base64'),
    gmail: fakeGmail(calls),
  };
};

const sha256 = s => createHash('sha256').update(s).digest('hex');

const subjects = ({ threads }) => threads.map(t => t.messages.map(m => m.subject));

// scripts/mail-cache.js, over the same story: the web app's replies, by way of E
const webkey = 'https://script.google.com/macros/s/DEPLOY/exec#s=';
const fakeFetch = E => async (url, { body }) => {
  assert.equal(url, 'https://script.google.com/macros/s/DEPLOY/exec');
  const { s, method, args } = JSON.parse(body);
  let reply;
  try {
    reply = { ok: E(s)[method](...args) };
  } catch (err) {
    reply = { error: err.message };
  }
  return { ok: true, json: async () => JSON.parse(JSON.stringify(reply)) };
};

test('parseWebkey and fileName', () => {
  assert.deepEqual(parseWebkey(`${webkey}abc\n`), { base: 'https://script.google.com/macros/s/DEPLOY/exec', s: 'abc' });
  assert.throws(() => parseWebkey('https://script.google.com/macros/s/DEPLOY/exec'), /expected/);
  assert.equal(
    fileName({ id: 'a2', date: 'Tue, 2 Jun 2026 10:15:00 -0500', subject: 'Re: Claim 0042: inspection' }),
    '2026-06-02-re-claim-0042-inspection-a2.eml',
  );
  assert.equal(fileName({ id: 'x9' }), 'undated-no-subject-x9.eml');
});

// gcaps.js and mail-cache.js, with gcaps.js loaded once for them all
test('gcaps', async t => {
  const { makeCapTable_, makeMinter_, makeMailQuery_, invoke_ } = await loadGcaps({ readFile });
  // the table and the minter, given just the powers each takes; and
  // E(s).method(...args), which does what doPost does
  const story = () => {
    const io = makeIO();
    const { sheet, digest, random, now, gmail, base64 } = io;
    const table = makeCapTable_({ sheet, digest, revive: query => makeMailQuery_({ gmail, base64 }, query) });
    const minter = makeMinter_({ sheet, digest, random, now });
    /** @param {unknown} s */
    const E = s =>
      new Proxy({}, {
        get: (_target, method) => (...args) => invoke_(table.lookup(s), method, args),
      });
    return { ...io, table, minter, E };
  };

  await t.test('minting a row fills in its id and created; the swiss number goes only to the owner', () => {
    const { grid, minter } = story();
    const { swiss } = minter.mint(2);
    assert.equal(swiss, 'swiss1');
    assert.deepEqual(grid[1], [sha256(swiss), 'label:agent roof claim', 'for Claude: hail roof', '2026-11-13T20:00:00.000Z']);
    assert.ok(!JSON.stringify(grid).includes(`"${swiss}"`));
  });

  await t.test("a webkey shows the threads its row's query finds", () => {
    const { minter, E } = story();
    const found = E(minter.mint(2).swiss).threads();
    assert.equal(found.query, 'label:agent roof claim');
    assert.deepEqual(subjects(found), [
      ['Claim 0042: payment issued'],
      ['Claim 0042: inspection', 'Re: Claim 0042: inspection'],
    ]);
    assert.equal(found.more, false);
  });

  await t.test('raw: a message in a thread it shows, and no other', () => {
    const { minter, E } = story();
    const mail = E(minter.mint(2).swiss);
    const { raw, threadId } = mail.raw('a2');
    assert.equal(threadId, 't1');
    assert.equal(Buffer.from(raw, 'base64').toString(), 'Subject: Re: Claim 0042: inspection\r\n\r\nhi\r\n');
    assert.throws(() => mail.raw('c1'), /not found: c1/); // the query doesn't find it
    assert.throws(() => mail.raw('d1'), /not found: d1/);
  });

  await t.test('editing the query steers the webkey; deleting the row revokes it', () => {
    const { grid, minter, E } = story();
    const mail = E(minter.mint(2).swiss);
    grid[1][1] = 'roof';
    assert.equal(mail.threads().threads.length, 3);
    grid[1][1] = ' ';
    assert.throws(() => mail.threads(), /no such webkey/);
    grid[1][1] = 'roof';
    grid.splice(1, 1);
    assert.throws(() => mail.threads(), /no such webkey/);
  });

  await t.test('a guess, or a method the query lacks, gets nothing', () => {
    const io = story();
    const { table, minter, E } = io;
    const swiss = minter.mint(2).swiss;
    for (const s of ['swiss2', '', undefined, { toString: () => swiss }]) {
      assert.throws(() => E(s).threads(), /no such webkey/);
    }
    for (const method of ['constructor', 'toString', '__proto__', 'then']) {
      assert.throws(() => E(swiss)[method](), /no such method/);
    }
    const mail = table.lookup(swiss);
    assert.throws(() => invoke_(mail, 42, []), /no such method: 42/);
    assert.throws(() => invoke_(mail, 'threads', 'x'), /args: not an array/);
    assert.throws(() => E(swiss).raw({ id: 'a1' }), /id: not a string/);
    assert.equal(io.calls.length, 0, 'no mail read');
  });

  await t.test('mint: a row with a query and no id', () => {
    const { minter } = story();
    minter.mint(2);
    assert.throws(() => minter.mint(2), /row 2 has a webkey/);
    assert.throws(() => minter.mint(4), /row 4: no query/);
    assert.throws(() => minter.mint(1), /row 1: not a Webkeys row/);
    assert.throws(() => minter.mint(9), /row 9: not a Webkeys row/);
    assert.throws(() => makeCapTable_({ sheet: null }), /no Webkeys sheet/);
    assert.throws(() => makeMinter_({ sheet: null }), /no Webkeys sheet/);
  });

  await t.test('cacheMail saves each message once', async () => {
    const { minter, E } = story();
    const client = makeClient(webkey + minter.mint(2).swiss, fakeFetch(E));
    const files = new Map([['2026-06-02-claim-0042-inspection-a1.eml', 'saved before']]);
    const fs = {
      mkdir: async () => {},
      readdir: async () => [...files.keys()],
      writeFile: async (p, data, opts) => {
        if (opts?.flag === 'wx' && files.has(p)) throw Error(`exists: ${p}`);
        files.set(p, String(data));
      },
    };
    const path = { join: (...parts) => parts.at(-1) };
    const { saved } = await cacheMail(client, 'out', { fs, path });
    assert.deepEqual(saved, ['2026-07-06-claim-0042-payment-issued-b1.eml', '2026-06-02-re-claim-0042-inspection-a2.eml']);
    assert.equal(files.get('2026-06-02-claim-0042-inspection-a1.eml'), 'saved before');
    assert.equal(JSON.parse(files.get('threads.json')).threads.length, 2);
    assert.deepEqual((await cacheMail(client, 'out', { fs, path })).saved, []);
  });
});
