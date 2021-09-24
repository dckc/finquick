// @ts-check

import requireText from 'require-text';
import { WebApp } from './WebApp';
import { GCBook } from './gcbook';

const { entries } = Object;

const LunchMoneyAPI = {
  endpoint: 'https://dev.lunchmoney.app',
};

/**
 * lmSync - sync client for Lunch Money API
 *
 * @param { string[] } args
 * @param { typeof process.env } env
 * @param {{
 *   https: typeof import('https'),
 *   mysql: typeof import('mysql'),
 *   require: typeof require,
 * }} io
 */
export const lmSync = async (args, env, { https, mysql }) => {
  const { LUNCH_MONEY_API_KEY: apiKey } = env;
  const creds = { Authorization: `Bearer ${apiKey}` };

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

  const api = WebApp(LunchMoneyAPI.endpoint, { https }, creds);
  const all = {
    categories: api.pathjoin('/v1/categories').get(),
    assets: api.pathjoin('/v1/assets').get(),
    plaid_accounts: api.pathjoin('/v1/plaid_accounts').get(),
    transactions: api.pathjoin('/v1/transactions').get(),
  };

  const bk = mkBook();
  try {
    for await (const [kind, req] of entries(all)) {
      console.log('fetching', kind, 'from Lunch Money API');
      const body = await req;
      const info = JSON.parse(body);
      // ISSUE: check for errors
      // ISSUE: pagination
      await bk.importSlots(
        `lunchmoney.app/${kind}`,
        info[kind].map(data => ({ id: data.id, data })),
      );
    }
  } finally {
    await bk.close();
  }
};

/* global require, module, process */
if (require.main === module) {
  lmSync(
    process.argv.slice(2),
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
