// @ts-check
import requireText from 'require-text';

import { WebApp } from './WebApp';
import { GraphQL } from './graphql';
import { GCBook } from './gcbook';

export const UniswapAPI = {
  endPoint: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2',
  qPositions: requireText('./positions.graphql', require),
  qTransactions: requireText('./transactions.graphql', require),
};

const q = JSON.stringify;

/** @type {(obj: unknown) => string} */
const fmt = obj => JSON.stringify(obj, null, 2);
/** @type {(txt: string) => number} */
const amt = txt => parseFloat(txt);

/**
 * @param {{
 *   env: typeof process.env,
 *   https: typeof import('https'),
 *   mysql: typeof import('mysql'),
 * }} io
 */
async function main({ env, https, mysql }) {
  const gql = GraphQL(WebApp(UniswapAPI.endPoint, { https }));

  const ethAddr = env.ETH_ADDR;
  if (!ethAddr) {
    throw new Error('ETH_ADDR not set');
  }

  // await fetchPositions(gql, ethAddr);

  const txs = await gql.runQuery(UniswapAPI.qTransactions, { user: ethAddr });
  const kinds = ['burns', 'mints', 'swaps'];
  kinds.forEach(kind => console.log('found', txs.data[kind].length, kind));

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

  const bk = mkBook();
  await bk.exec('drop table if exists uniswap'); //@@@
  await bk.exec(`create table if not exists uniswap(
    kind varchar(16),
    id varchar(256),
    data JSON
  ) character set=utf8 collate=utf8_general_ci`);
  await Promise.all(
    kinds.map(kind =>
      bk.exec(`insert into uniswap(kind, id, data) values ?`, [
        txs.data[kind].map(tx => [kind, tx.id, q(tx)]),
      ]),
    ),
  );
  await bk.close();
}

if (require.main === module) {
  main({
    https: require('follow-redirects').https,
    env: process.env,
    mysql: require('mysql'),
  }).catch(err => {
    console.error(err);
  });
}

async function fetchPositions(gql, ethAddr) {
  const result = await gql.runQuery(UniswapAPI.qPositions, { id: ethAddr });
  console.log(fmt(result));
  const positions = result.data.user.liquidityPositions.map(position => {
    const poolOwnership =
      amt(position.liquidityTokenBalance) / amt(position.pair.totalSupply);
    const valueUSD = poolOwnership * amt(position.pair.reserveUSD);
    console.log({
      name: `${position.pair.token0.symbol}-${position.pair.token1.symbol}`,
      valueUSD,
    });
  });
}
