// @ts-check
import { MsgWalletSpendAction } from '@agoric/cosmic-proto/swingset/msgs.js';

import { Registry } from '@cosmjs/proto-signing';
import { GasPrice, defaultRegistryTypes } from '@cosmjs/stargate';

// https://github.com/Agoric/agoric-sdk/blob/master/golang/cosmos/daemon/main.go
export const Bech32MainPrefix = 'agoric';

export const CoinType = 564;

/**
 * `/agoric.swingset.XXX` matches package agoric.swingset in swingset/msgs.proto
 * aminoType taken from Type() in golang/cosmos/x/swingset/types/msgs.go
 */
export const SwingsetMsgs = {
  MsgWalletSpendAction: {
    typeUrl: '/agoric.swingset.MsgWalletSpendAction',
    aminoType: 'swingset/WalletSpendAction',
  },
};

export const SwingsetRegistry = new Registry([
  ...defaultRegistryTypes,
  // XXX should this list be "upstreamed" to @agoric/cosmic-proto?
  [SwingsetMsgs.MsgWalletSpendAction.typeUrl, MsgWalletSpendAction],
]);

// https://community.agoric.com/t/network-change-instituting-fees-on-the-agoric-chain-to-mitigate-spam-transactions/109/2
// minimum-gas-prices = "0.01ubld,0.005uist"
export const gasPriceStake = GasPrice.fromString('0.01ubld');
export const gasPriceStable = GasPrice.fromString('0.005uist');
