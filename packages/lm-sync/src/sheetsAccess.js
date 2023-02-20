// @ts-check

import { GoogleSpreadsheetRow } from 'google-spreadsheet';
import { makeORM } from './server.js';

// based on
// https://github.com/Agoric/testnet-notes/blob/main/subm/src/sheetAccess.js
// 8dbbe50 on Dec 23, 2021

/**
 * @param {GoogleSpreadsheetWorksheet} sheet
 * @param {string | number} key
 * @throws on not found
 */
export const lookup = async (sheet, key) => {
  // load primary key column
  // @ts-expect-error types are wrong?
  await sheet.loadCells({
    startColumnIndex: 0,
    endColumnIndex: 1,
  });

  let rowIndex = 1;
  for (; rowIndex < sheet.rowCount; rowIndex += 1) {
    const { value } = sheet.getCell(rowIndex, 0);
    if (value === null) throw RangeError(`${key}`); // empty row: end of data
    if (key === value) {
      break;
    }
  }
  if (rowIndex === sheet.rowCount) throw RangeError(`${key}`);
  const [row] = await sheet.getRows({ offset: rowIndex - 1, limit: 1 });
  if (!row) throw TypeError('should not happen');
  return row;
};

/**
 * @param {GoogleSpreadsheetWorksheet} sheet
 * @param {string | number} key
 * @param {Record<string, string | number>} record
 * @typedef {import('google-spreadsheet').GoogleSpreadsheetWorksheet} GoogleSpreadsheetWorksheet
 */
export const upsert = async (sheet, key, record) => {
  let row;
  try {
    row = await lookup(sheet, key);
  } catch (_notFound) {
    // ignore
  }
  if (row) {
    Object.assign(row, record);
    // @ts-expect-error types are wrong?
    // docs clearly show a raw option
    // https://theoephraim.github.io/node-google-spreadsheet/#/classes/google-spreadsheet-row?id=fn-save
    await row.save({ raw: true });
  } else {
    row = await sheet.addRow(record);
  }
  return row;
};

/** @param {string} message */
const fail = message => {
  throw Error(message);
};

/** @type {<K, V>(m: Map<K, Promise<V>>, k: K, f: (k: K) => Promise<V>) => Promise<V>} */
const provide = (m, k, f) => {
  const p = m.get(k);
  if (p) return p;
  const p1 = new Promise((resolve, reject) => {
    f(k).then(resolve, reject);
  });
  m.set(k, p1);
  return p1;
};

/** @param {import('google-spreadsheet').GoogleSpreadsheet} doc */
export const makeSheetsORM = doc => {
  const { entries, freeze } = Object;

  const tables = {
    Accounts: 'Accounts',
    Categories: 'Categories',
    Transactions: 'Transactions (2)',
  };

  /** @type {Map<string, Promise<GoogleSpreadsheetRow[]>>} */
  const cache = new Map();

  return freeze({
    /**
     * @param {keyof tables} table
     * @param {Record<string, string | number>} keyFields
     */
    lookup: async (table, keyFields) => {
      const rows = await provide(cache, table, async k => {
        const sheet = doc.sheetsByTitle[tables[table]];
        const rows = await sheet.getRows();
        return rows;
      });
      // match by string form
      const found = rows.filter(row =>
        entries(keyFields).every(([col, val]) => row[col] === `${val}`),
      );
      if (found.length !== 1)
        throw `found ${found.length} in ${table} matching ${JSON.stringify(
          keyFields,
        )}`;
      const [it] = found;
      return freeze({
        get: () => it,
        /** @param {Record<string, unknown>} dataFields */
        update: dataFields => Object.assign(it, dataFields),
      });
    },
    /**
     * @param {keyof tables} table
     * @param {number} [offset]
     * @param {number} [limit]
     */
    getPage: async (table, offset, limit) => {
      const sheet = doc.sheetsByTitle[tables[table]];
      return sheet.getRows({ offset, limit });
    },
  });
};

/**
 * @param {ReturnType<makeSheetsORM>} sc Sheetsync "ORM"
 * @param {ReturnType<makeORM>} gc GnuCash "ORM"
 */
export const matchTxs = async (sc, gc) => {
  const trial = 15;
  const txs = await sc.getPage('Transactions', 0, trial);

  for await (const tx of txs) {
    const { ['Account #']: acctNum, ['Account']: acctName } = tx;
    const acct = await sc
      .lookup('Accounts', {
        'Account #': acctNum,
        Account: acctName,
      })
      .then(it => it.get());
    const detail = gc
      .lookup('split_detail', {
        post_date: tx.Date,
        amount: Number(tx.Amount.replace(/[,$]/g, '')),
        code: acct.code,
      })
      .get();
    console.log('found split:', detail);
  }
};

/**
 * @param {Record<string, string | undefined>} env
 * @returns {Record<string, string>}
 */
const makeConfig = env =>
  /** @ts-expect-error cast */
  new Proxy(env, {
    get(_t, name, _r) {
      if (typeof name !== 'string') throw RangeError(String(name));
      const out = env[name] || fail(`missing ${String(name)}`);
      return out;
    },
    set(_t, _p, _v) {
      throw Error('read-only');
    },
  });

/**
 * @param {string[]} _argv
 * @param {Record<string, string | undefined>} env
 * @param {Object} io
 * @param {typeof import('fs/promises')} io.fsp
 * @param {(path: string, opts: *) => SqliteDB} io.openSqlite
 * @param {typeof import('google-spreadsheet').GoogleSpreadsheet} io.GoogleSpreadsheet
 * @typedef {import('better-sqlite3').Database} SqliteDB
 */
const main = async (_argv, env, { fsp, openSqlite, GoogleSpreadsheet }) => {
  const config = makeConfig(env);
  const creds = await fsp
    .readFile(config.PROJECT_CREDS, 'utf-8')
    .then(s => JSON.parse(s));

  // Initialize the sheet - doc ID is the long id in the sheets URL
  const doc = new GoogleSpreadsheet(env.SHEET1_ID);

  // Initialize Auth - see https://theoephraim.github.io/node-google-spreadsheet/#/getting-started/authentication
  await doc.useServiceAccountAuth(creds);

  await doc.loadInfo(); // loads document properties and worksheets
  console.log({
    doc: { title: doc.title },
  });

  const db = openSqlite(config.GNUCASH_DB, {
    verbose: console.log,
  });

  const scORM = makeSheetsORM(doc);
  const gcORM = makeORM(db);
  await matchTxs(scORM, gcORM);
};

/* global require, process */
if (process.env.SHEET1_ID) {
  Promise.all([
    await import('fs/promises'),
    import('better-sqlite3'),
    import('google-spreadsheet'),
  ]).then(([fsp, sqlite3, GoogleSpreadsheet]) =>
    main(
      process.argv.slice(2),
      { ...process.env },
      {
        fsp: fsp.default,
        openSqlite: (path, opts) => sqlite3.default(path, opts),
        GoogleSpreadsheet: GoogleSpreadsheet.GoogleSpreadsheet,
      },
    ).catch(err => console.error(err)),
  );
}
