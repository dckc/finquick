/* global require, module, process */
// @ts-check

import requireText from 'require-text';
import { GCBook } from './gcbook';
import { WebApp } from './WebApp';

// const BASE = 'https://api.cosmos.network';
// const BASE = 'https://lcd-cosmos.cosmostation.io';
const BASE = 'https://node.atomscan.com';
// const BASE = 'https://cosmos.rpc.node.cracklord.com';
// const BASE = 'https://rpc.cosmos.network:26657';
// const BASE = 'https://rpc.cosmos.network';
// https://lcd-cosmos.cosmostation.io/cosmos/distribution/v1beta1/delegators/cosmos1u6zjae6khlh9e9fgq8cde4rrdymdcr5n59s7dp/rewards
// https://lcd-cosmos.cosmostation.io/cosmos/distribution/v1beta1/delegators/cosmos1u6zjae6khlh9e9fgq8cde4rrdymdcr5n59s7dp/withdraw_address
// https://lcd-cosmos.cosmostation.io/cosmos/staking/v1beta1/delegations/cosmos1u6zjae6khlh9e9fgq8cde4rrdymdcr5n59s7dp
// https://lcd-cosmos.cosmostation.io/cosmos/staking/v1beta1/delegators/cosmos1u6zjae6khlh9e9fgq8cde4rrdymdcr5n59s7dp/unbonding_delegations
// https://lcd-cosmos.cosmostation.io/cosmos/staking/v1beta1/delegators/cosmos1u6zjae6khlh9e9fgq8cde4rrdymdcr5n59s7dp/redelegations
// https://api.cosmostation.io/v1/account/txs/cosmos1u6zjae6khlh9e9fgq8cde4rrdymdcr5n59s7dp

/**
 * @param { Record<string, string | undefined> } env
 * @param {{
 *   https: typeof import('https'),
 *   mysql: typeof import('mysql'),
 *   require: typeof require,
 * }} io
 */
async function main(env, { https, mysql }) {
  const ua = WebApp(BASE, { https });
  const addr = env.COSMOS_ADDR;
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
  let txs = [];
  for (const role of ['transfer.sender', 'transfer.recipient']) {
    const path = `/txs?${role}=${addr}`;

    // eslint-disable-next-line no-await-in-loop
    const content = await ua.pathjoin(path).get();
    const info = JSON.parse(content);
    // console.log(JSON.stringify(info, null, 2));
    txs = [...txs, ...info.txs];
    console.log({ role, qty: info.txs.length });
  }
  const bk = mkBook();
  try {
    await bk.importSlots(
      `cosmos.network`,
      txs.map(data => ({
        id: data.txhash,
        data,
      })),
    );
  } finally {
    await bk.close();
  }
}

if (require.main === module) {
  main(
    { ...process.env },
    {
      // eslint-disable-next-line global-require
      https: require('https'),
      // eslint-disable-next-line global-require
      mysql: require('mysql'),
      require,
    },
  ).catch(err => console.error(err));
}
