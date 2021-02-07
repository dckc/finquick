// @ts-check
import requireText from 'require-text';

import { WebApp } from './WebApp';
import { GraphQL } from './graphql';

export const UniswapAPI = {
  endPoint: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2',
  qPositions: requireText('./positions.graphql', require),
  qTransactions: requireText('./transactions.graphql', require),
};

/**
 * @param {{
 *   env: typeof process.env,
 *   https: typeof import('https'),
 * }} io
 */
async function main({ env, https }) {
  const gql = GraphQL(WebApp(UniswapAPI.endPoint, { https }));
  /** @type {(obj: unknown) => string} */
  const fmt = obj => JSON.stringify(obj, null, 2);
  /** @type {(txt: string) => number} */
  const amt = txt => parseFloat(txt);

  const ethAddr = env.ETH_ADDR;
  if (!ethAddr) {
    throw new Error('ETH_ADDR not set');
  }

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

  const txs = await gql.runQuery(UniswapAPI.qTransactions, { user: ethAddr });
  console.log(fmt(txs));
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
