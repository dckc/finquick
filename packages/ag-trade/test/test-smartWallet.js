// @ts-check
import '@endo/init';
import anyTest from 'ava';

import { captureIO, replayIO } from './replayFetch.js';
import { make as makeWalletFactory } from '../src/smartWallet.js';
import { E } from '@endo/far';
import { makeHttpClient, makeLCD } from '../src/httpClient.js';
import { web1 } from './web-fixture.js';

/** @type {import('ava').TestFn<Awaited<ReturnType<typeof makeTestContext>>>} */
const test = /** @type {any} */ (anyTest);

const RECORDING = false;

const acct = {
  validator: {
    address: 'agoric14pfrxg63jn6ha0cp6wxkm4nlvswtscrh2pymwm',
    mnemonic:
      'sunny slam blast income daring give vote goat bid response beauty delay grunt payment volcano guess crime organ repair that enroll logic toilet defy',
  },
  user1: {
    address: 'agoric1a3zu5aqw255q0tuxzy9aftvgheekw2wedz3xwq',
    mnemonic:
      'congress goose visual acid shine view pair fruit chaos boost cigar upgrade certain warrior color omit perfect clutch little bulb divorce split fashion switch',
  },
};

const scenario1 = {
  rpcURL: 'http://localhost:26657',
  apiURL: 'http://localhost:1317',
};

const makeTestContext = async () => {
  return { fetch: globalThis.fetch, recording: RECORDING };
};

test.before(async t => {
  t.context = await makeTestContext();
});

const { keys } = Object;

test('executeOffer', async t => {
  const { context: io } = t;

  const { fetch: fetchMock, web } = io.recording
    ? captureIO(io.fetch)
    : { fetch: replayIO(web1), web: new Map() };

  const wf = makeWalletFactory();

  const kit = await E(wf).makeWalletKit(
    acct.user1.mnemonic,
    makeHttpClient(scenario1.rpcURL, fetchMock),
    makeLCD(scenario1.apiURL, { fetch: fetchMock }),
  );
  t.deepEqual(keys(kit), ['tx', 'query', 'smartWallet']);

  const { query, smartWallet } = kit;

  const istBrand = await E(query).lookup('agoricNames', 'brand', 'IST');

  const make = (brand, value) => harden({ brand, value });

  const give = {
    Collateral: make(istBrand, 10n),
  };

  /** @type {import('@agoric/smart-wallet/src/offers.js').OfferSpec} */
  const offerSpec = {
    id: 'reserveAdd1',
    invitationSpec: {
      source: 'agoricContract',
      instancePath: ['reserve'],
      callPipe: [['makeAddCollateralInvitation', []]],
    },
    proposal: { give },
  };

  const info = await E(smartWallet).executeOffer(offerSpec);

  t.is(typeof info.tx.height, 'number');
  t.is(typeof info.tx.transactionHash, 'string');

  t.deepEqual(info.status, {
    id: 'reserveAdd1',
    invitationSpec: offerSpec.invitationSpec,
    numWantsSatisfied: 1,
    payouts: info.status.payouts,
    proposal: offerSpec.proposal,
    result: 'added Collateral to the Reserve',
  });

  if (io.recording) {
    t.snapshot(web, 'sendTokens web');
  }
});
