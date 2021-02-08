// @ts-check

const { check } = require('./check');
const { WebApp } = require('./WebApp');
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
 * @param {string} apiKey
 *
 * @typedef { import('./WebApp').Query } Query
 */
function makeEtherscan(web, apiKey) {
  function txlist(/** @type { string } */ address) {
    const params = {
      apikey: apiKey,
      module: 'account',
      action: 'txlist',
      address: address,
    };
    return paged(params, tx0);
  }

  function txlistinternal(/** @type { string } */ address) {
    const params = {
      apikey: apiKey,
      module: 'account',
      action: 'txlistinternal',
      address: address,
    };
    return paged(params, tx0);
  }

  /**
   * @param {Query} params
   * @param {T} _template
   * @returns {Promise<{
   *   status: string,
   *   message: string,
   *   result: T[],
   * }>}
   * @template T
   */
  async function call(params, _template) {
    const body = await web.query(params).get();
    return JSON.parse(body);
  }

  /**
   * @param {Query} params
   * @param {T} template
   * @returns {Promise<T[]>}
   * @template T
   */
  async function paged(params, template) {
    /** @type {T[][]} */
    let pages = [];
    let page = 1;
    let qty = 1;
    let pagedParams;
    while (qty) {
      pagedParams = { ...params, page: `${page}`, offset: 128 };
      const x = await call(pagedParams, template);
      if (!x.result.length) {
        break;
      }
      pages.push(x.result);
      qty = x.result.length;
      page += 1;
    }
    return pages.flat();
  }

  function ETH(/** @type { string } */ address) {
    function transactions() {
      async function list() {
        const txData = await txlist(address); // ISSUE: error handling
        const txiData = await txlistinternal(address);
        const byHash = {};
        txData.concat(txiData).forEach(function(tx) {
          var row = byHash[tx.hash];
          if (!row) {
            row = {};
            byHash[tx.hash] = row;
          }
          row[tx.gasPrice > '' ? 'normal' : 'internal'] = tx;
          row.hash = tx.hash;
          row.timeStamp = parseInt(tx.timeStamp);
        });
        const rows = values(byHash).sort((a, b) => a.timeStamp - b.timeStamp);
        return rows;
      }

      function unpack(txData) {
        const wei = 1.0 / Math.pow(10, 18);
        function unpack1(txs) {
          const tx = 'internal' in txs ? txs.internal : txs.normal;
          const parent = txs.normal;
          return {
            hash: tx.hash,
            dt: new Date(parseInt(tx.timeStamp) * 1000),
            value: parseInt(tx.value) * wei,
            sign: tx.to == address ? 1 : -1,
            txFee:
              parent && parent.from == address
                ? parseInt(parent.gasUsed) * parseInt(parent.gasPrice) * wei
                : 0,
            acct2: tx.to == address ? tx.from : tx.to,
          };
        }
        txData = txData.map(unpack1);
        const hd = ['hash', 'dt', 'value', 'sign', 'txFee', 'acct2']; // Object.keys(txData[0]);
        const rows = txData.map(function(tx) {
          return hd.map(function(k) {
            return tx[k];
          });
        });
        return { hd: hd, rows: rows };
      }

      return freeze({ list, unpack });
    }
    return freeze({ transactions });
  }

  /**
   * @param {string} contractaddress
   * @param {string} address
   */
  function token(contractaddress, address) {
    function transactions() {
      async function list() {
        const params = {
          apikey: apiKey,
          module: 'account',
          action: 'tokentx',
          contractaddress: contractaddress,
          address: address,
        };
        const out = await call(params, tx0);
        return out.result; // ISSUE: error handling
      }

      function unpack(txData) {
        const hd = [
          'hash',
          'dt',
          'value',
          'tokenDecimal',
          'tokenSymbol',
          'sign',
          'acct2',
        ];

        const rows = txData.map(function(tx) {
          const out = {
            hash: tx.hash,
            dt: new Date(parseInt(tx.timeStamp) * 1000),
            value: parseInt(tx.value),
            tokenDecimal: parseInt(tx.tokenDecimal),
            tokenSymbol: tx.tokenSymbol,
            sign: tx.to == address ? 1 : -1,
            acct2: tx.to == address ? tx.from : tx.to,
          };
          return hd.map(function(k) {
            return out[k];
          });
        });

        return { hd, rows };
      }

      return freeze({ list, unpack });
    }

    return freeze({ transactions });
  }

  return freeze({ ETH, token });
}

/**
 *
 * @param {ReturnType<typeof import('./gcbook').GCBook>} bk
 * @param {Tx[]} txs
 * @typedef {typeof tx0} Tx
 */
async function save(bk, txs) {
  await bk.exec('drop table if exists ERC20'); //@@@
  await bk.exec(`create table if not exists ERC20 (
    hash varchar(256),
    data JSON
  ) character set=utf8 collate=utf8_general_ci`);
  await bk.exec(`insert into ERC20(hash, data) values ?`, [
    txs.map(tx => [tx.hash, JSON.stringify(tx)]),
  ]);
}

/**
 *
 * @param {{
 *   env: typeof process.env,
 *   https: typeof import('https'),
 *   mysql: typeof import('mysql'),
 * }} io
 */
async function main({ env, https, mysql }) {
  const apiKey = check.notNull(env.ETHERSCAN_APIKEY);
  const svc = makeEtherscan(WebApp(base, { https }), apiKey);
  const account = check.notNull(env.ETH_ADDR);

  const txSvc = svc.token(RHOC, account).transactions();
  console.log('fetching ERC20 transaction data...');
  const txs = await txSvc.list();
  console.log('found', txs.length);

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
  console.log('saving to ERC20 table...');
  await save(bk, txs);
  console.log('saved.');
  await bk.close();
}

if (require.main === module) {
  main({
    env: process.env,
    https: require('https'),
    mysql: require('mysql'),
  }).catch(err => {
    console.error(err);
  });
}
