/**
 * @file endo plugin for cosmos network protocol primitives: RPC, LCD (aka API).
 */
// @ts-check
/* global globalThis */
import { Far } from '@endo/far';
import { makeHttpClient, makeLCD } from './httpClient.js';

export const make = _powers => {
  console.log('cosmosFetch worker');
  /** @param { string } rpcURL */
  const makeRPCClient = rpcURL => makeHttpClient(rpcURL, globalThis.fetch);
  /** @param { string } apiURL */
  const makeLCDClient = apiURL => makeLCD(apiURL, { fetch: globalThis.fetch });

  return Far('CosmosFetch', {
    makeRPCClient,
    makeLCDClient,
  });
};
