/* global require, module, process */
// @ts-check

import requireText from 'require-text';
import { GCBook } from './gcbook';
import { WebApp } from './WebApp';

const { entries, fromEntries } = Object;

// https://api.anchorprotocol.com/api/v1/history/terra16d39g540fywlkhk533f2cwm9fnq9as08hr9u95
// https://fcd.terra.dev/v1/tx/FBFF9A71439D71CF6DD397CF8769E3DA8A04172F1501F2C3D6D2908034976629

const API = {
  Terra: 'https://fcd.terra.dev/v1/',
  Anchor: 'https://api.anchorprotocol.com/api/v1/',
};

/**
 * @param { Record<string, string | undefined> } env
 * @param {{
 *   https: typeof import('https'),
 *   mysql: typeof import('mysql'),
 *   require: typeof require,
 * }} io
 */
async function main(env, { https, mysql }) {
  const anchor = WebApp(API.Anchor, { https });
  const terra = WebApp(API.Terra, { https });
  const addr = env.TERRA_ADDR;
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

  /** @type {Record<string, unknown>} */
  const anchorHistory = await anchor
    .pathjoin(`history/${addr}`)
    .get()
    .then(s => fromEntries(JSON.parse(s).history.map(tx => [tx.tx_hash, tx])));

  const bk = mkBook();
  try {
    await bk.importSlots(
      `anchorprotocol.com/history`,
      entries(anchorHistory).map(([id, data]) => ({ id, data })),
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
