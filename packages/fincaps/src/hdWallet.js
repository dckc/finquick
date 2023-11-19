// @ts-check
import { E, Far } from '@endo/far';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { stringToPath } from '@cosmjs/crypto';

import * as agoric from './agoricZone.js';

const hdPath = (coinType = 118, account = 0) =>
  stringToPath(`m/44'/${coinType}'/${account}'/0/0`);

const path0 = [hdPath(agoric.CoinType, 0)];

/**
 * @param {string} mnemonic
 * @param {Partial<import('@cosmjs/proto-signing').DirectSecp256k1HdWalletOptions>} [opts]
 * @returns {Promise<import('@cosmjs/proto-signing').OfflineDirectSigner>}
 */
export const fromMnemonic = async (mnemonic, opts = {}) => {
  const { prefix = agoric.Bech32MainPrefix, hdPaths = path0 } = opts;
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    ...opts,
    prefix,
    hdPaths,
  });

  /** @type {import('@cosmjs/proto-signing').OfflineDirectSigner} */
  const methods = {
    getAccounts: () => wallet.getAccounts(),
    signDirect: (address, signDoc) => wallet.signDirect(address, signDoc),
  };
  return Far('HdWallet', methods);
};

export const make = async () => Far('HdWalletMaker', { fromMnemonic });
