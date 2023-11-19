// @ts-check
import '@endo/init';
import test from 'ava';

import { E } from '@endo/far';
import { fromMnemonic } from '../src/hdWallet.js';

/** @typedef {import('cosmjs-types/cosmos/tx/v1beta1/tx.js').SignDoc} SignDoc */

const user1 = {
  address: 'agoric1a3zu5aqw255q0tuxzy9aftvgheekw2wedz3xwq',
  mnemonic:
    'congress goose visual acid shine view pair fruit chaos boost cigar upgrade certain warrior color omit perfect clutch little bulb divorce split fashion switch',
};

test('sign with hdWallet', async t => {
  const expected = {
    pub_key: {
      type: 'tendermint/PubKeySecp256k1',
      value: 'AuGKJjWqdm5dSRpeKDUdQxGvn1QYhD0JRAqSFS4QEugJ',
    },
    signature:
      'jIw0T37y95hDYz5OoRTtUmWbO4fLMuJemCO1ArR1i+tqGVcKnvZPcNO1sIjJ6M86eS3kvmEmEolDRlbp9zMPVw==',
  };
  const w = await fromMnemonic(user1.mnemonic);

  // TODO: this is bogus
  const authInfoBytes = Uint8Array.from([4, 5, 6]);

  /** @type {SignDoc} */
  const signDoc = {
    bodyBytes: Uint8Array.from([1, 2, 3]),
    authInfoBytes,
    chainId: 'chain',
    accountNumber: 1n,
  };
  const p = E(w).signDirect(user1.address, signDoc);
  await t.notThrowsAsync(p);
  const sig = await p;
  t.deepEqual(sig, { signature: expected, signed: signDoc });
});
