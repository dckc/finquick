/* global require, module, process */
// @ts-check

import requireText from 'require-text';
import { GCBook } from './gcbook';
import { WebApp } from './WebApp';

// https://stellar.expert/openapi.html#tag/Payment-Locator-API
const BASE = 'https://api.stellar.expert/explorer/';
const NETWORK = 'public';

const SLOT_NAME = `stellar/payments`;

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
  const addr = env.STELLAR_ADDR;
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
  const path = `/explorer/${NETWORK}/payments?account=${addr}`;
  // eslint-disable-next-line no-await-in-loop
  const content = await ua.pathjoin(path).get();
  const info = JSON.parse(content);
  // console.log(JSON.stringify(info, null, 2));
  // eslint-disable-next-line no-underscore-dangle
  const {
    _embedded: { records },
  } = info;
  console.log({ SLOT_NAME, qty: records.length });
  const bk = mkBook();
  try {
    await bk.importSlots(
      SLOT_NAME,
      records.map(data => ({ id: data.id, data })),
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
