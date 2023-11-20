// @ts-check

import { E, Far } from '@endo/far';

const UNIT6 = 1_000_000n;

/**
 * @param {import("./smartWallet").WalletKit['smartWallet']} smartWallet
 * @param {{ brand: Remotable, value: bigint }} amount
 * @param {string} id
 */
export const addToReserve = async (smartWallet, amount, id) => {
  assert.typeof(id, 'string');

  const make = (brand, value) => harden({ brand, value });

  const give = { Collateral: amount };

  /** @type {import('@agoric/smart-wallet/src/offers.js').OfferSpec} */
  const offerSpec = {
    id,
    invitationSpec: {
      source: 'agoricContract',
      instancePath: ['reserve'],
      callPipe: [['makeAddCollateralInvitation', []]],
    },
    proposal: { give },
  };

  const info = await E(smartWallet).executeOffer(offerSpec);
  return info;
};

export const make = () => Far('ReserveTool', { addToReserve });
