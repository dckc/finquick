// @ts-check

import { check } from './check';
import { WebApp } from './WebApp';
import { GCBook } from './gcbook';

const { freeze } = Object;

const base = 'https://api.etherscan.io/api?';

const RHOC = '0x168296bb09e24a88805cb9c33356536b980d3fc5';

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
 */
function makeEtherscan(web, apikey, delay) {
  /** @type {Promise<void>?} */
  let rateLimit;

  /**
   * @param {Query} params
   * @param {T} _template
   * @returns {Promise<T[]>}
   * @template T
   */
  async function call(params, _template) {
    if (rateLimit) await rateLimit;
    const body = await web.query(params).get();
    const info = JSON.parse(body);
    if (!['0', '1'].includes(info.status)) throw Error(info.message);
    if (info.error) throw Error(info.error.message || info.error);
    if (info.result === 'Max rate limit reached') {
      console.log({ info });
      throw Error(info.result);
    }
    rateLimit = delay(250);
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
    let pages = [];
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
 * @param {ReturnType<typeof import('./gcbook').GCBook>} bk
 * @param {string} table
 * @param {Tx[]} txs
 * @typedef {typeof tx0} Tx
 */
async function save(bk, table, txs) {
  console.log('saving ', txs.length, 'transactions to ', table);
  await bk.exec(`drop table if exists ${table}`); //@@@
  await bk.exec(`create table if not exists ${table} (
    hash varchar(256),
    data JSON
  ) character set=utf8 collate=utf8_general_ci`);
  await bk.exec(`insert into ${table}(hash, data) values ?`, [
    txs.map(tx => [tx.hash, JSON.stringify(tx)]),
  ]);
}

/**
 *
 * @param {{
 *   env: typeof process.env,
 *   https: typeof import('https'),
 *   mysql: typeof import('mysql'),
 *   setTimeout: typeof setTimeout,
 * }} io
 */
async function main({ env, https, mysql, setTimeout }) {
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
    return GCBook(connect, _ => '');
  }

  const bk = mkBook();
  console.log('fetching transaction data for', account);
  await Promise.all([
    svc
      .account(account)
      .txlist()
      .then(txs => save(bk, 'ETH', txs)),
    svc
      .account(account)
      .txlist('txlistinternal')
      .then(txs => save(bk, 'ETH_I', txs)),
    svc
      .account(account)
      .tokentx()
      .then(txs => save(bk, 'ERC20', txs)),
  ]);
  await bk.close();
}

if (require.main === module) {
  main({
    env: process.env,
    https: require('https'),
    mysql: require('mysql'),
    setTimeout,
  }).catch(err => {
    console.error(err);
  });
}
