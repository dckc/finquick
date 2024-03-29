// @ts-check

import requireText from 'require-text';
import { WebApp } from './WebApp';
import { DBsqlite, GCBook } from './gcbook';

const { entries } = Object;

const Usage = `
lmSync gnucash.db
`;

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
 *   openSqlite: (path: string) => SqliteDB
 *   require: typeof require,
 * }} io
 * @typedef {import('better-sqlite3').Database} SqliteDB
 */
export const lmSync = async (args, env, { https, openSqlite }) => {
  const { LUNCH_MONEY_API_KEY: apiKey } = env;
  const creds = { Authorization: `Bearer ${apiKey}` };

  const [filename] = args;
  if (!filename) {
    throw Error(Usage);
  }

  function mkBook() {
    const connect = () => openSqlite(filename);
    const db = DBsqlite({
      connect,
      process: { pid: -1, hostname: () => '@@hostname' },
    });

    return GCBook(db, m => requireText(m, require));
  }

  /** @type { (app: ReturnType<WebApp>, kind:string) => Promise<Array<any>> } */
  const paginate = async (app, kind) => {
    const pages = [];
    for (let offset = 0, qty = -1; qty !== 0; offset += qty) {
      // eslint-disable-next-line no-await-in-loop
      const page = await app
        .pathjoin(
          `/v1/${kind}?start_date=1993-01-01&end_date=2050-01-01&offset=${offset}&limit=128`,
        )
        .get();
      const items = JSON.parse(page)[kind];
      pages.push(items);
      qty = items.length;
      console.log({ offset, qty });
    }
    return pages.flat();
  };
  const api = WebApp(LunchMoneyAPI.endpoint, { https }, creds);

  const all = {
    categories: api.pathjoin('/v1/categories').get(),
    assets: api.pathjoin('/v1/assets').get(),
    plaid_accounts: api.pathjoin('/v1/plaid_accounts').get(),
  };

  const bk = mkBook();
  try {
    const txKind = 'transactions';
    const transactions = await paginate(api, txKind);
    await bk.importSlots(
      `lunchmoney.app/${txKind}`,
      transactions.map(data => ({ id: data.id, data })),
    );

    for await (const [kind, req] of entries(all)) {
      console.log('fetching', kind, 'from Lunch Money API');
      const body = await req;
      const info = JSON.parse(body);
      // ISSUE: check for errors
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
      openSqlite: path => require('better-sqlite3')(path),
      require,
    },
  ).catch(err => console.error(err));
}
