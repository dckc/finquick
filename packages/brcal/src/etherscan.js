/* eslint-disable no-await-in-loop */
// @ts-check
import requireText from 'require-text';

import { check } from './check';
import { WebApp } from './WebApp';
import { GCBook } from './gcbook';

const { freeze } = Object;

const base = 'https://api.etherscan.io/api?';

// const RHOC = '0x168296bb09e24a88805cb9c33356536b980d3fc5';

const tx0 = {
  blockNumber: '4357197',
  timeStamp: '1507750117',
  hash: '0x7b..',
  nonce: '294',
  blockHash: '0x68..',
  from: '0x4f..',
  contractAddress: '0x168296bb09e24a88805cb9c33356536b980d3fc5',
  to: '0x3d...',
  value: '831417000000',
  tokenName: 'RHOC',
  tokenSymbol: 'RHOC',
  tokenDecimal: '8',
  transactionIndex: '12',
  gas: '6050000',
  gasPrice: '22284624259',
  gasUsed: '100757',
  cumulativeGasUsed: '654402',
  input: 'deprecated',
  confirmations: '7455854',
};

/**
 * @param {ReturnType<typeof import('./WebApp').WebApp> } web
 * @param {string} apikey
 * @param {(ms: number) => Promise<void> } delay
 * @typedef { import('./WebApp').Query } Query
 *
 * @typedef { typeof tx0 } Tx
 */
function makeEtherscan(web, apikey, delay) {
  async function* rateLimit() {
    for (;;) {
      yield;
      await delay(250);
    }
  }
  const opportunities = rateLimit();
  // console.time('rateLimit');

  /**
   * @param {Query} params
   * @param {T} _template
   * @returns {Promise<T[]>}
   * @template T
   */
  async function call(params, _template) {
    await opportunities.next();
    // console.timeEnd('rateLimt');
    // console.log(params);
    // console.time('rateLimt');
    const body = await web.query(params).get();
    const info = JSON.parse(body);
    if (!['0', '1'].includes(info.status)) throw Error(info.message);
    if (info.error) throw Error(info.error.message || info.error);
    if (info.result === 'Max rate limit reached') {
      console.log({ info });
      throw Error(info.result);
    }
    return info.result;
  }

  /**
   * @param {Query} params
   * @param {T} ex
   * @returns {Promise<T[]>}
   * @template T
   */
  async function paged(params, ex) {
    /** @type {T[][]} */
    const pages = [];
    let page = 1;
    for (;;) {
      const items = await call({ ...params, page: `${page}`, offset: 128 }, ex);
      if (!items.length) break;
      pages.push(items);
      page += 1;
    }
    return pages.flat();
  }

  return freeze({
    account(/** @type { string } */ address) {
      const params = { module: 'account', apikey, address };
      return freeze({
        async txlist(
          /** @type { 'txlist' | 'txlistinternal' } */ action = 'txlist',
        ) {
          return paged({ ...params, action }, tx0);
        },
        /** @type { (c?: string) => Promise<Tx[]> } */
        async tokentx(contractaddress) {
          const action = 'tokentx';
          /** @type {Query} */
          const token = contractaddress ? { contractaddress } : {};
          return paged({ ...params, action, ...token }, tx0);
        },
      });
    },
  });
}

/**
 *
 * @param {{
 *   env: typeof process.env,
 *   https: typeof import('https'),
 *   mysql: typeof import('mysql'),
 *   setTimeout: typeof setTimeout,
 *   require: typeof require,
 * }} io
 */
async function main({ env, https, mysql, setTimeout, require }) {
  const apiKey = check.notNull(env.ETHERSCAN_APIKEY);
  /** @type {(ms: number) => Promise<void> } */
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const svc = makeEtherscan(WebApp(base, { https }), apiKey, delay);
  const account = check.notNull(env.ETH_ADDR);

  function mkBook() {
    const connect = () =>
      Promise.resolve(
        mysql.createConnection({
          host: env.GC_HOST,
          user: env.GC_USER,
          password: env.GC_PASS,
          database: env.GC_DB,
        }),
      );
    return GCBook(connect, m => requireText(m, require));
  }

  console.log('fetching transaction data for', account);
  const acct = svc.account(account);
  const parts = {
    txlist: acct
      .txlist()
      .then(txs => txs.map(data => ({ id: data.hash, data }))),
    txlistinternal: acct
      .txlist('txlistinternal')
      .then(txs =>
        txs.map(data => ({ id: `${data.hash}#${data.traceId}`, data })),
      ),
    tokentx: acct
      .tokentx()
      .then(txs =>
        txs.map(data => ({ id: `${data.hash}#${data.contractAddress}`, data })),
      ),
  };
  const bk = mkBook();
  for (const [kind, recordsP] of Object.entries(parts)) {
    const records = await recordsP;
    await bk.importSlots(`etherscan.io/${kind}`, records);
  }
  await bk.close();
}

/* global require, module, setTimeout, process */
if (require.main === module) {
  main({
    env: process.env,
    // eslint-disable-next-line global-require
    https: require('https'),
    // eslint-disable-next-line global-require
    mysql: require('mysql'),
    setTimeout,
    require,
  }).catch(err => {
    console.error(err);
  });
}
