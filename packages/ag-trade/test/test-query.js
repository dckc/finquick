// @ts-check
import '@endo/init';
import anyTest from 'ava';

import { captureIO, replayIO } from './replayFetch.js';
import { makeVStorage } from '../src/batchQuery.js';
import { makeLCD } from '../src/httpClient.js';
import { web2 } from './web-fixture.js';

/** @type {import('ava').TestFn<Awaited<ReturnType<typeof makeTestContext>>>} */
const test = /** @type {any} */ (anyTest);

const RECORDING = false;

const scenario1 = {
  apiURL: 'http://localhost:1317',
  addr: 'agoric1a3zu5aqw255q0tuxzy9aftvgheekw2wedz3xwq',
};

const makeTestContext = async () => {
  // XXX should probably raise the recording to the RPC/LCD level.
  const { fetch, web } = RECORDING
    ? captureIO(globalThis.fetch)
    : { fetch: replayIO(web2), web: new Map() };
  return { fetch, web, recording: RECORDING };
};

test.before(async t => {
  t.context = await makeTestContext();
});

test('wallet updates', async t => {
  const { fetch, recording, web } = t.context;
  const lcd = makeLCD(scenario1.apiURL, { fetch });
  const vstore = makeVStorage(lcd);
  for await (const actual of vstore.readHistory(
    `published.wallet.${scenario1.addr}`,
  )) {
    if (actual === undefined) break;
    t.true(Array.isArray(actual));
  }
  recording && t.snapshot(web, 'wallet updates');
});

test('live vstorage.readStorage', async t => {
  const { fetch, web, recording } = t.context;
  const lcd = makeLCD(scenario1.apiURL, { fetch });
  const vstore = makeVStorage(lcd);
  {
    const item = await vstore.readStorage(
      'published.wallet.agoric1a3zu5aqw255q0tuxzy9aftvgheekw2wedz3xwq',
    );
    const cell = JSON.parse(item.value);
    t.deepEqual(Object.keys(cell), ['blockHeight', 'values']);
  }
  {
    const item = await vstore.readStorage('published.agoricNames.brand');
    const cell = JSON.parse(item.value);
    t.deepEqual(Object.keys(cell), ['blockHeight', 'values']);
  }
  recording && t.snapshot(web, 'readStorage');
});
