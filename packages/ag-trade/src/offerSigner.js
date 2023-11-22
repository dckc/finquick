// @ts-check
import { E, Far } from '@endo/far';
import { encodeSecp256k1Pubkey } from '@cosmjs/amino';
import { stringToPath } from '@cosmjs/crypto';
import { fromBase64 } from '@cosmjs/encoding';
import { TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx.js';
import {
  DirectSecp256k1HdWallet,
  encodePubkey,
  makeAuthInfoBytes,
  makeSignDoc,
} from '@cosmjs/proto-signing';
import { SwingsetRegistry } from './agoricZone.js';

const { Fail, quote: q } = assert;

// cribbed from https://github.com/Agoric/faucet/blob/35c4bb7/src/gift.js
// and
// https://github.com/cosmos/cosmjs/blob/a8e151a617cfa1e3467b1cdbf65679a9a529c18b/packages/stargate/src/signingstargateclient.ts#L21

const hdPath = (coinType = 118, account = 0) =>
  stringToPath(`m/44'/${coinType}'/${account}'/0/0`);

// https://github.com/Agoric/agoric-sdk/blob/master/golang/cosmos/daemon/main.go
const Agoric = {
  Bech32MainPrefix: 'agoric',
};

/**
 * @template {Record<string, unknown>} T
 * @typedef {{[P in keyof T]: Exclude<T[P], undefined>;}} AllDefined
 */

/**
 * Concise way to check values are available from object literal shorthand.
 * Throws error message to specify the missing values.
 *
 * from @agoric/internal
 *
 * @template {Record<string, unknown>} T
 * @param {T} obj
 * @throws if any value in the object entries is not defined
 * @returns {asserts obj is AllDefined<T>}
 */
export const assertAllDefined = obj => {
  const missing = [];
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined) {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    Fail`missing ${q(missing)}`;
  }
};

/** @param {string} mnemonic */
export const walletFromMnemonic = async mnemonic => {
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: Agoric.Bech32MainPrefix,
    hdPaths: [hdPath(Agoric.CoinType, 0)],
  });
  const [signer] = await wallet.getAccounts();
  return { wallet, signer };
};

/**
 * @typedef {{
 *   registry?: import('@cosmjs/proto-signing').Registry;
 *   accountNumber?: number;
 *   sequence?: number;
 *   chainId?: string;
 *   fee?: import('@cosmjs/amino').StdFee;
 *   memo?: string;
 *   timeoutHeight?: bigint,
 * }} SignerOpts
 */

/**
 * @param {DirectSecp256k1HdWallet} wallet
 * @param {import('@cosmjs/proto-signing').AccountData} signer
 * @param {import('@cosmjs/proto-signing').EncodeObject[]} messages
 * @param {SignerOpts} opts
 */
export const sign = async (wallet, signer, messages, opts) => {
  const {
    accountNumber = Fail`accountNumber missing`,
    chainId = Fail`chainId missing`,
    sequence = Fail`sequence missing`,
    fee = Fail`fee missing`,
    memo,
    timeoutHeight,
    registry = SwingsetRegistry,
  } = opts;
  const pubkey = encodePubkey(encodeSecp256k1Pubkey(signer.pubkey));
  /** @type {import('@cosmjs/proto-signing').TxBodyEncodeObject} */
  const txBodyEncodeObject = {
    typeUrl: '/cosmos.tx.v1beta1.TxBody',
    value: {
      messages: messages,
      memo,
      // @ts-expect-error signingstargateclient.ts uses bigint
      timeoutHeight,
    },
  };
  const txBodyBytes = registry.encode(txBodyEncodeObject);
  const authInfoBytes = makeAuthInfoBytes(
    [{ pubkey, sequence }],
    fee.amount,
    Number(fee.gas),
    undefined,
    undefined,
  );
  const signDoc = makeSignDoc(
    txBodyBytes,
    authInfoBytes,
    chainId,
    accountNumber,
  );
  const { signature, signed } = await wallet.signDirect(
    signer.address,
    signDoc,
  );
  return TxRaw.fromPartial({
    bodyBytes: signed.bodyBytes,
    authInfoBytes: signed.authInfoBytes,
    signatures: [fromBase64(signature.signature)],
  });
};

/** @param {import('./secret-tool').PassKey} item */
const fromPassKey = async item => {
  const [_p, mnemonic] = await Promise.all([
    E(item).properties(),
    E(item).get(),
  ]);

  const { wallet, signer } = await walletFromMnemonic(mnemonic);

  /**
   * @param {SignerOpts} opts0
   */
  const make = opts0 => {
    let myOpts = opts0;
    return Far('Signer', {
      /** @param {SignerOpts} opts */
      withOpts: opts => {
        return make({ ...myOpts, ...opts });
      },
      /** @param {SignerOpts} opts */
      setOpts: opts => {
        myOpts = { ...myOpts, ...opts };
      },

      /**
       * @param {import('@cosmjs/proto-signing').EncodeObject[]} messages
       * @param {SignerOpts} [opts]
       */
      sign: (messages, opts) =>
        sign(wallet, signer, messages, { ...myOpts, ...opts }),
    });
  };
};

export const make = async () => {
  return Far('OfferSigner', { fromPassKey });
};
