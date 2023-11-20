// @ts-check
import '@endo/init';
import anyTest from 'ava';

import { captureIO, replayIO } from './replayFetch.js';
import { makeLCD, makeVStorage } from '../src/batchQuery.js';

/** @type {import('ava').TestFn<Awaited<ReturnType<typeof makeTestContext>>>} */
const test = /** @type {any} */ (anyTest);

const RECORDING = false;

const scenario1 = {
  apiURL: 'http://localhost:1317',
  addr: 'agoric1a3zu5aqw255q0tuxzy9aftvgheekw2wedz3xwq',
};

const makeTestContext = async () => {
  return { fetch: globalThis.fetch, recording: RECORDING };
};

test.before(async t => {
  t.context = await makeTestContext();
});

test.only('wallet updates', async t => {
  const io = t.context;
  const lcd = makeLCD(scenario1.apiURL, { fetch: io.fetch });
  const vstore = makeVStorage(lcd);
  for await (const actual of vstore.readHistory(
    `published.wallet.${scenario1.addr}`,
  )) {
    t.is(actual, ['@@@TODO']);
  }
});

test('live vstorage.readStorage', async t => {
  const io = t.context;
  const lcd = makeLCD(scenario1.apiURL, { fetch: io.fetch });
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
});
