/**
 * @file Agoric smart wallet proxy
 */
// @ts-check

import { E, Far } from '@endo/far';
import {
  SigningStargateClient,
  assertIsDeliverTxSuccess,
} from '@cosmjs/stargate';
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';

import { toAccAddress } from '@cosmjs/stargate/build/queryclient/utils.js';
import { toBase64 } from '@cosmjs/encoding';

// XXX move these to @agoric/cosmic-proto?
import { SwingsetMsgs, SwingsetRegistry, gasPriceStake } from './agoricZone.js';
// TODO: move httpClient to its own module
import { makeHttpClient } from './httpClient.js';
import { fromMnemonic } from './hdWallet.js';
import { makeClientMarshaller } from './marshalTables.js';
import { batchVstorageQuery } from './batchQuery.js';

/** @template T @typedef {import('@endo/eventual-send').ERef<T>} ERef<T> */
/** @typedef {import('@cosmjs/proto-signing').OfflineDirectSigner} OfflineDirectSigner */

export { assertIsDeliverTxSuccess };

/**
 * @param {string} address
 * @param {string} spendAction
 * @returns {import('@cosmjs/proto-signing').EncodeObject}
 */
export const makeWalletActionMessage = (address, spendAction) => ({
  typeUrl: SwingsetMsgs.MsgWalletSpendAction.typeUrl,
  value: {
    owner: toBase64(toAccAddress(address)),
    spendAction,
  },
});

/**
 * @param {OfflineDirectSigner} nearSigner
 * @param {import('@cosmjs/tendermint-rpc').RpcClient} rpcClient
 *
 * TODO: allow overriding default options
 */
export const makeSigningClient = async (nearSigner, rpcClient) => {
  const cometClient = await Tendermint34Client.create(rpcClient);

  // TODO: remote signer.
  // not yet feasible: can't pass Uint8Array
  //   /** @type {OfflineDirectSigner} */
  //   const nearSigner = {
  //     getAccounts: () => E(farSigner).getAccounts(),
  //     signDirect: (address, signDoc) => E(farSigner).signDirect(address, signDoc),
  //   };

  const nearClient = await SigningStargateClient.createWithSigner(
    cometClient,
    nearSigner,
    {
      // amino not (yet) supported
      // aminoTypes: new AminoTypes(converters),
      registry: SwingsetRegistry,
      gasPrice: gasPriceStake,
    },
  );
  //   console.debug('signingClient', keys(signingClient));

  return Far('SigningClient', {
    /** @param {Parameters<SigningStargateClient['sign']>} args*/
    sign: (...args) => nearClient.sign(...args),
    /** @param {Parameters<SigningStargateClient['broadcastTx']>} args*/
    broadcastTx: (...args) => nearClient.broadcastTx(...args),
    /**
     * @param {Parameters<SigningStargateClient['signAndBroadcast']>} args
     * @throws if account does not exist on chain, user cancels,
     *         RPC connection fails, RPC service fails to broadcast (
     *         for example, if signature verification fails)
     *
     * NOTE: use assertIsDeliverTxSuccess(tx) to check for success
     */
    signAndBroadcast: (...args) => nearClient.signAndBroadcast(...args),
    /** @param {Parameters<SigningStargateClient['sendTokens']>} args*/
    sendTokens: (...args) => nearClient.sendTokens(...args),
  });
};

export const make = () => {
  /**
   * @param {string} mnemonic
   * @param {string} url
   */
  const makeTxTool = async (mnemonic, url) => {
    const signer = await fromMnemonic(mnemonic);
    const rpcClient = makeHttpClient(url, fetch);
    return makeSigningClient(signer, rpcClient);
  };

  const makeQueryTool = apiUrl => {
    const m = makeClientMarshaller();

    /** @param {['children' | 'data', string][]} paths */
    const query = async paths =>
      batchVstorageQuery(apiUrl, m.fromCapData, paths, { fetch });

    const nameHubCache = new Map();

    const lookupKind = async kind => {
      assert.typeof(kind, 'string');
      if (nameHubCache.has(kind)) {
        return nameHubCache.get(kind);
      }
      const [[_p, { value: entries }]] = await query([
        ['data', `published.agoricNames.${kind}`],
      ]);
      const record = Object.fromEntries(entries);
      nameHubCache.set(kind, record);
      return record;
    };

    const invalidate = () => {
      nameHubCache.clear();
    };

    /**
     * @param {string} hub
     * @param {string} kind
     * @param {string} name
     */
    const lookup = async (hub, kind, name) => {
      assert.equal(hub, 'agoricNames');
      const record = await lookupKind(kind);
      return record[name];
    };

    return Far('QueryTool', { query, lookup, invalidate });
  };

  return Far('SmartWalletFactory', {
    // makeSigningClient,
    makeTxTool,
    makeQueryTool,
  });
};
