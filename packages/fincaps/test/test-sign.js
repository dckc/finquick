// @ts-check
import '@endo/init';
import anyTest from 'ava';
import { fromBech32, toBase64 } from '@cosmjs/encoding';

import { fromMnemonic } from '../src/hdWallet.js';
import { makeSigningClient } from '../src/smartWallet.js';

import { SwingsetMsgs, sign, walletFromMnemonic } from '../src/offerSigner.js';

import { captureIO, replayIO } from './replayFetch.js';
import { makeHttpClient } from '../src/httpClient.js';

import { web1 } from './web-fixture.js';

/** @typedef {import("@cosmjs/stargate").StdFee} StdFee */

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
  endpoint: 'http://localhost:26657',
};

const istDenom = 'uist';

/** @type {import('ava').TestFn<Awaited<ReturnType<typeof makeTestContext>>>} */
const test = /** @type {any} */ (anyTest);

const makeTestContext = async () => {
  return { fetch: globalThis.fetch, recording: RECORDING };
};

test.before(async t => {
  t.context = await makeTestContext();
});

/**
 * @param {string} address
 * @returns {Uint8Array}
 */
const toAccAddress = address => {
  return fromBech32(address).data;
};

/**
 * @returns {StdFee}
 */
const zeroFee = () => {
  const fee = {
    amount: [{ amount: '0', denom: istDenom }],
    gas: '300000', // TODO: estimate gas?
  };
  return fee;
};

test(`sign and broadcast bank send (RECORDING: ${RECORDING})`, async t => {
  const { context: io } = t;

  const { fetch: fetchMock, web } = io.recording
    ? captureIO(io.fetch)
    : { fetch: replayIO(web1), web: new Map() };
  const rpcClient = makeHttpClient(scenario1.endpoint, fetchMock);

  const signer = await fromMnemonic(acct.validator.mnemonic);

  const sigops = [];
  const recordingSigner = {
    ...signer,
    signDirect: async (...args) => {
      const result = await signer.signDirect(...args);
      sigops.push({ args, result });
      return result;
    },
  };

  const client = await makeSigningClient(recordingSigner, rpcClient);

  const fee = zeroFee();

  const denom = 'ubld';

  const actual = await client.sendTokens(
    acct.validator.address,
    acct.user1.address,
    [{ denom, amount: '1' }],
    fee,
  );

  t.snapshot(sigops, 'signer');
  if (io.recording) {
    t.snapshot(web, 'sendTokens web');
  }

  const expected = {
    code: 0,
    transactionHash:
      '4E3CC7E178696FC1013DA53E714DBD2C983D60AB9B937E8ADC1A93870E926A83',
  };

  t.like(actual, expected, 'sendTokens');
});

test.skip('sign and broadcast offer', async t => {
  const spendAction = '{}';
  const expected = '@@@';

  const { address, mnemonic } = acct.user1;
  const { wallet, signer } = await walletFromMnemonic(mnemonic);

  const act1 = {
    typeUrl: SwingsetMsgs.MsgWalletSpendAction.typeUrl,
    value: {
      owner: toBase64(toAccAddress(address)),
      spendAction,
    },
  };

  const messages = [act1];
  const fee = zeroFee();

  //   console.debug('sign spend action', { address, messages, fee });

  const opts = { accountNumber: 123, chainId: 'test', sequence: 456, fee };
  const actual = await sign(wallet, signer, messages, opts);
  t.deepEqual(actual, expected);
});

test('RECORDING is false unless developing', t => t.false(RECORDING));
