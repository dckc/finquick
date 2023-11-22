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
  const x = await powers;
  //   console.log({ powers: x });

  /** @type { ERef<import('./smartWallet').QueryTool> } */
  const vstorage = await E(powers).request(
    'HOST',
    'vstorage query tool',
    'vstorage',
  );

  //   console.log({ vstorage });
  //   const istBrand = await E(vstorage).lookup('agoricNames', 'brand', 'IST');
  //   console.log('Hello, World!', args, istBrand);
  const gov1 = 'agoric1acfcen6peh9ed9tyrj5wyqtfrf7hthrh5smddy'; // XXX
  const focus = E(vstorage).ofWallet(gov1);
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
      console.log('@@@@@', update);
      if (update.updated === 'offerStatus') {
        const { status } = update;
        if (bids.has(status.id)) {
          console.log('@@@', status);
          bids.set(status.id, { ...bids.get(status.id), status });
        }
      }
    },
  });
  await E(focus).history(visitor);
  return bids;
};
