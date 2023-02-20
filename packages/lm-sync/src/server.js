/**
 * @file GnuCash sync service
 * Back end: simple query API plus PATCH.
 * Front end: fetch from other services and let the user compose patches.
 */

/* eslint-disable no-continue */
// @ts-check
/* global __dirname */
import bodyParser from 'body-parser';

const loc = /** @type {const} */ ({
  home: '/',
  ui: '/ui',
  gnucash: {
    accounts: '/gnucash/accounts',
    transactions: '/gnucash/transactions',
  },
  lunchmoney: {
    transactions: '/lunchmoney/transactions',
  },
});

const page = /** @type {const} */ ({
  home: `
      <ul>
        <li>lunchmoney
          <ul>
            <li><a href="${loc.lunchmoney.transactions}">transactions</a></li>
          </ul>
        </li>
      </ul>`,
});

/**
 * ref https://github.com/Gnucash/gnucash/blob/48b29f5/libgnucash/engine/kvp-value.hpp#L57-L73
 */
const KvpType = /** @type {const} */ ({
  INT64: 1,
  STRING: 4,
});

const { freeze, keys } = Object;

const fail = (/** @type {string} */ reason) => {
  throw Error(reason);
};

/**
 * @param {string[]} fields
 * @param {string} [sep]
 */
const clause = (fields, sep = ', ') =>
  fields.map(n => `${n} = :${n}`).join(sep);

/** @param {SqliteDB} db */
export const makeORM = db => {
  const self = freeze({
    /**
     * @param {string} table
     * @param {Record<string, unknown>} keyFields
     */
    lookup: (table, keyFields) =>
      freeze({
        get: () => {
          const stmt = db.prepare(`
            select * from ${table}
            where ${clause([...keys(keyFields)], ' and ')}
          `);
          return stmt.get(keyFields);
        },
        /** @param {Record<string, unknown>} dataFields */
        update: dataFields => {
          const stmt = db.prepare(`
            update ${table}
            set ${clause([...keys(dataFields)])}
            where ${clause([...keys(keyFields)], ' and ')}
          `);
          stmt.run({ ...dataFields, ...keyFields });
        },
      }),
    /**
     * @param {string} table
     * @param {Record<string, unknown>} fields
     */
    insert: (table, fields) => {
      const names = [...keys(fields)];
      const params = names.map(n => `:${n}`).join(', ');
      const stmt = db.prepare(`
        insert into ${table} (${names.join(', ')}) values (${params})`);
      stmt.run(fields);
    },
    /**
     * @param {string} table
     * @param {Record<string, unknown>} keyFields
     * @param {Record<string, unknown>} dataFields
     */
    upsert: (table, keyFields, dataFields) => {
      const it = self.lookup(table, keyFields);
      const v = it.get();
      if (v) {
        it.update(dataFields);
        return;
      }
      self.insert(table, { ...keyFields, ...dataFields });
    },
  });
  return self;
};

const firstSystemdFD = 3;

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

/**
 * Patch a GnuCash transaction
 *
 * @param {ReturnType<typeof makeORM>} book
 * @param {TxEdit} txEdit
 * @typedef {{ guid: string }} GCKey GnuCash object keyed by uuid
 * @typedef {GCKey & {
 *   description: string,
 *   splits: (SplitAcctEdit | SlotEdit)[]
 * }} TxEdit
 * @typedef {GCKey & {
 *   account: { code: number },
 *   memo: string
 * }} SplitAcctEdit
 * @typedef {GCKey & { slots: IntSlot[] }} SlotEdit
 * @typedef {{ obj_guid: string, name: string, int64_val: number }} IntSlot
 */
const patchTransaction = (book, txEdit) => {
  const { guid: txGuid, description } = txEdit;
  if (typeof txGuid !== 'string') {
    console.warn('bad tx', txEdit);
    return;
  }
  book.lookup('transactions', { guid: txGuid }).update({ description });
  for (const split of txEdit.splits || []) {
    if ('account' in split) {
      const {
        guid: splitGuid,
        account: { code },
        memo,
      } = split;
      if (!(typeof splitGuid === 'string' && typeof code === 'string')) {
        console.log('bad split', split);
        continue;
      }
      const account = book.lookup('accounts', { code }).get();
      if (!(account && account.guid)) {
        console.log('no account', { code });
        continue;
      }
      book.lookup('splits', { guid: splitGuid }).update({
        account_guid: account.guid,
        ...(typeof memo === 'string' ? { memo } : {}),
      });
    } else {
      for (const slot of split.slots) {
        const { obj_guid: objGuid, name, int64_val: val } = slot;
        if (
          !(
            typeof objGuid === 'string' &&
            typeof name === 'string' &&
            typeof val === 'number'
          )
        ) {
          console.warn('bad int64_val slot', slot);
          continue;
        }
        book.upsert(
          'slots',
          { obj_guid: objGuid, name },
          { slot_type: KvpType.INT64, int64_val: val },
        );
      }
    }
  }
};

/**
 * Attach query routes to app.
 *
 * @param {ReturnType<typeof import('express')>} app
 * @param {SqliteDB} db
 */
const attachQueries = (app, db) => {
  app.get(loc.home, (_req, res) => res.send(page.home));

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

  app.get(loc.gnucash.accounts, (req, res) => {
    const accts = db
      .prepare(
        `select a.*, s.string_val notes
        from accounts a
        left join slots s on s.obj_guid = a.guid and s.name = 'notes'
        order by account_type, code, name`,
      )
      .all();
    res.send(JSON.stringify(accts));
  });

  /**
   * especially: get uncategorized transactions
   */
  app.get(loc.gnucash.transactions, (req, res) => {
    const code = req.query.code;
    const rows = db
      .prepare(
        `select tx from tx_json
        where json_extract(tx, '$.splits[1].code') = :code
        or json_extract(tx, '$.splits[0].code') = :code
        order by post_date desc, tx_guid, guid`,
      )
      .all({ code });
    const txs = rows.map(({ tx }) => JSON.parse(tx));
    console.log(200, loc.gnucash.transactions, {
      code,
      rowCount: rows.length,
      first: rows.slice(0, 1),
      last: rows.slice(-1),
    });
    res.send(JSON.stringify(txs));
  });
};

/**
 * Attach mutation routes to app.
 *
 * @param {ReturnType<typeof import('express')>} app
 * @param {SqliteDB} db
 */
const attachMutations = (app, db) => {
  app.use(bodyParser.json());

  const orm = makeORM(db);
  const applyPatch = db.transaction(edits => {
    for (const edit of edits) {
      patchTransaction(orm, edit);
    }
  });

  app.patch(loc.gnucash.transactions, (req, res) => {
    console.log('PATCH txs:', req.body.length);
    applyPatch(req.body);
    res.send(`${req.body.length}`);
  });
};

/**
 * @param {Object} io
 * @param {typeof import('express')} io.express
 * @param {typeof import('path')} io.path
 * @param {Record<string, string|undefined>} io.env
 * @param {(path: string, opts: *) => SqliteDB} io.openSqlite
 *
 * @typedef {import('better-sqlite3').Database} SqliteDB
 */
const main = ({ env, path, express, openSqlite }) => {
  const db = openSqlite(env.GNUCASH_DB || fail(`missing $GNUCASH_DB`), {
    verbose: console.log,
  });

  const app = express();

  app.use(loc.ui, express.static(path.join(__dirname, '..', 'ui')));
  attachQueries(app, db);
  attachMutations(app, db);

  const port = getPort(8000, { env });
  app.listen(port);
  console.log(`serving at http://localhost:${port}`);
};

/* global require, module, process */
if (typeof require !== 'undefined' && require.main === module) {
  main({
    env: process.env,
    // eslint-disable-next-line global-require
    express: require('express'),
    // eslint-disable-next-line global-require
    path: require('path'),
    // eslint-disable-next-line global-require
    openSqlite: (path, opts) => require('better-sqlite3')(path, opts),
  });
}
