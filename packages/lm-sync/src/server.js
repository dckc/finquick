// @ts-check

const firstSystemdFD = 3;

const fail = (/** @type {string} */ reason) => {
  throw Error(reason);
};

/**
 *
 * @param {number} defaultPort
 * cf. https://systemd.network/sd_listen_fds.html
 * cf. https://www.npmjs.com/package/socket-activation
 * @param {Object} io
 * @param {Record<string, string|undefined>} io.env
 */
const getPort = (defaultPort, { env }) => {
  // console.log(env)
  if (!env.LISTEN_FDS) return defaultPort;
  const listenFDs = parseInt(env.LISTEN_FDS, 10);
  return { fd: firstSystemdFD + listenFDs - 1 };
};

const loc = {
  lunchmoney: {
    transactions: '/lunchmoney/transactions',
  },
};

const page = {
  home: `
    <ul>
      <li>lunchmoney
        <ul>
          <li><a href="${loc.lunchmoney.transactions}">transactions</a></li>
        </ul>
      </li>
    </ul>`,
};

/**
 *
 * @param {ReturnType<typeof import('express')>} app
 * @param {SqliteDB} db
 */
const attach = (app, db) => {
  app.get('/', (_req, res) => res.send(page.home));
  app.get(loc.lunchmoney.transactions, (_req, res) => {
    // const todo = `select * from (select * from slots where name = ?) slot
    // where slot.string_val->>'$.plaid_account_id' = ?
    // and slot.string_val->>'$.date' >= ?`;
    const rows = db
      .prepare(`select * from slots where name = ?`)
      .all('lunchmoney.app/transactions');
    const txs = rows.map(({ string_val: val }) => JSON.parse(val));
    res.send(JSON.stringify(txs));
  });
};

/**
 *
 * @param {Object} io
 * @param {ReturnType<typeof import('express')>} io.app
 * @param {Record<string, string|undefined>} io.env
 * @param {(path: string) => SqliteDB} io.openSqlite
 *
 * @typedef {import('better-sqlite3').Database} SqliteDB
 */
const main = ({ app, env, openSqlite }) => {
  const db = openSqlite(env.GNUCASH_DB || fail(`missing $GNUCASH_DB`));
  attach(app, db);
  const port = getPort(8000, { env });
  app.listen(port);
  console.log(`serving at http://localhost:${port}`);
};

/* global require, module, process */
if (require.main === module) {
  main({
    env: process.env,
    // eslint-disable-next-line global-require
    app: require('express')(),
    // eslint-disable-next-line global-require
    openSqlite: path => require('better-sqlite3')(path),
  });
}
