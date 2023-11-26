#!/bin/env endo
// https://github.com/endojs/endo/tree/endo/packages/cli/demo#running-a-confined-script
// @ts-check

/** @template T @typedef {import('@endo/eventual-send').ERef<T>} ERef<T> */

import { E, Far } from '@endo/far';

/**
 *
 * @param { *} powers
 * @param  {...any} args
 * @returns
 */
export const main = async (powers, ...args) => {
  /** @type { ERef<import('./smartWallet').WalletView> } */
  const focus = await E(powers).request('HOST', 'wallet view', 'wallet');

  const gov1 = 'agoric1acfcen6peh9ed9tyrj5wyqtfrf7hthrh5smddy'; // XXX
  const { liveOffers } = await E(focus).current();
  //   console.log(liveOffers);
  const bids = new Map();
  for (const [id, spec] of liveOffers) {
    // console.log('bid?', spec);
    const {
      invitationSpec: {
        source,
        instancePath: [name],
      },
    } = spec;
    // TODO: or contract with the right instance
    if (source === 'agoricContract' && name === 'auctioneer') {
      console.log(spec.proposal.give);
      bids.set(id, { offerSpec: spec });
    }
  }

  const visitor = Far('Visitor', {
    visit: update => {
      if (update.updated === 'offerStatus') {
        const { status } = update;
        if (bids.has(status.id)) {
          bids.set(status.id, { ...bids.get(status.id), status });
        }
      }
    },
  });
  await E(focus).history(visitor);
  return bids;
};
