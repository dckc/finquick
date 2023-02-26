// @ts-check

/**
 * @file Match Sheetsync with GnuCash
 * @see {matchTxs} for main feature
 */

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
const provide = (store, key, make) => {
  const p = store.get(key);
  if (p) return p;
  const p1 = new Promise((resolve, reject) => {
    make(key).then(resolve, reject);
  });
  store.set(key, p1);
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
     * Get a range of rows.
     *
     * Also loads cells in this range in preparation for update.
     *
     * @param {keyof tables} table
     * @param {number} [offset] starting row
     * @param {number} [limit] number of rows
     */
    getPage: async (table, offset, limit) => {
      const sheet = doc.sheetsByTitle[tables[table]];
      /** @type {import('google-spreadsheet').WorksheetGridRange} */
      const cellRange = {
        startRowIndex: (offset || 0) + 1, // skip header
        endRowIndex: (offset || 0) + (limit || 0) + 1, // + 1 for header
        startColumnIndex: 0,
        endColumnIndex: sheet.columnCount,
      };
      const [_cells, rows] = await Promise.all([
        sheet.loadCells(cellRange),
        sheet.getRows({ offset, limit }),
      ]);
      return rows;
    },
    /**
     * Schedule update of fields of a row.
     *
     * Use .commit() to carry out pending updates.
     *
     * @param {keyof tables} table
     * @param {number} rowIndex 0-based, unlike row.rowIndex
     * @param {Record<string, string | number>} edits
     */
    update: (table, rowIndex, edits) => {
      const sheet = doc.sheetsByTitle[tables[table]];
      entries(edits).forEach(([k, v]) => {
        const columnIndex = sheet.headerValues.findIndex(v => v === k);
        // console.log('updating:', { rowIndex, k, columnIndex });
        const cell = sheet.getCell(rowIndex, columnIndex);
        cell.value = v;
      });
    },
    /**
     * @param {keyof tables} table
     */
    commit: async table => {
      const sheet = doc.sheetsByTitle[tables[table]];
      return sheet.saveUpdatedCells();
    },
  });
};

/**
 * Match Syncsheets transactions with GnuCash.
 *
 * For each row that does not yet have a tx_guid,
 * look it up in split_detail by date, amount, and account code.
 * Update tx_guid and online_id in Syncsheets.
 *
 * update sheets.Transactions dest
 * set dest.tx_guid = x.tx_guid
 *   , dest.online_id = x.online_id
 * from (
 *   select dest.rowNum, src.tx_guid, src.online_id
 *   from sheets.Transactions dest
 *   join gnucash.split_detail src
 *   on src.date = dest.date
 *   and src.amount = dest.amount
 *   and src.code = dest.code
 *   where dest.tx_guid is null
 * ) x where x.rowNum = dest.rowNum
 *
 * @param {ReturnType<makeSheetsORM>} sc Sheetsync "ORM"
 * @param {ReturnType<makeORM>} gc GnuCash "ORM"
 * @param {object} [pageOptions]
 * @param {number} [pageOptions.offset]
 * @param {number} [pageOptions.limit]
 */
export const matchTxs = async (sc, gc, { offset, limit } = {}) => {
  const txs = await sc.getPage('Transactions', offset, limit);
  //   const sample = {
  //     first: txs[0]._rawData,
  //     last: txs.at(-1)?._rawData,
  //   };
  console.log('Sheetsync txs:', txs.length);
  let modified = 0;

  for (const tx of txs) {
    if (tx.tx_guid >= '') continue;
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
    if (detail) {
      //   console.log('found split:', detail);
      const edits = {
        tx_guid: detail.tx_guid,
        ...(detail.online_id ? { online_id: detail.online_id } : {}),
      };
      sc.update('Transactions', tx.rowIndex - 1, edits);
      modified += 1;
    }
  }
  console.log('modified:', modified, { limit, offset });
  if (modified > 0) {
    await sc.commit('Transactions');
  }
};

/** @param {string} message */
const die = message => {
  throw Error(message);
};
/** @type {<T, R extends Record<string, T>>(p: string) => (rs: R[]) => Map<unknown, R> } */
const indexBy = prop => records => new Map(records.map(r => [r[prop], r]));
/** @type {<K, V>(k: K) => (m: Map<K, V>) => V} */
const mustGet = k => m => m.get(k) || die(`no ${k}`);

/**
 * For uncategorized GnuCash transactions (account code 9001)
 * apply category from Sheetsync where available.
 *
 * update splits
 * from (
 *   select tx_guid, guid split_guid, acct.guid account_guid
 *        , sd.memo
 *   from split_detail sd
 *   join sheets.Transaction stx on stx.tx_guid = sd.tx_guid
 *   join accounts acct on acct.code = sd.code
 *   where sd.code = '9001' and stx.Category > ''
 * ) xwalk
 * set splits.account_guid = xwalk.account_guid
 *   , splits.memo = xwalk.memo
 * where splits.guid = xwalk.split_guid;
 *
 * @param {ReturnType<makeSheetsORM>} sc Sheetsync "ORM"
 * @param {ReturnType<makeORM>} gc GnuCash "ORM"
 */
const updateGCFromSC = async (sc, gc, { offset = 0, limit = 3000 } = {}) => {
  console.log('await Transactions and Categories...');
  const [stxByGuid, catByName] = await Promise.all([
    sc
      .getPage('Transactions', offset, limit)
      .then(txs => txs.filter(tx => tx.Category > ''))
      .then(indexBy('tx_guid')),
    sc.getPage('Categories', 0, 1000).then(indexBy('Category')),
  ]);

  const acctByCode = indexBy('code')(gc.query('accounts', {}));
  for (const detail of gc.query('split_detail', { code: '9001' })) {
    const stx = stxByGuid.get(detail.tx_guid);
    if (!stx) continue;
    const code = mustGet(stx.Category)(catByName).code;
    const acct = mustGet(code)(acctByCode);
    console.log(
      'update',
      {
        post_date: detail.post_date,
        description: detail.description,
        memo: detail.memo,
        amount: detail.amount,
      },
      '->',
      {
        Description: stx.Description,
        memo: stx.memo,
        Category: stx.Category,
        code,
      },
    );
    gc.upsert(
      'splits',
      { guid: detail.guid },
      { account_guid: acct.guid, memo: stx.memo },
    );
    gc.upsert(
      'transactions',
      { guid: detail.tx_guid },
      { description: stx.Description },
    );
  }
};

/**
 * Make an object that throws on access to missing property.
 *
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
 * @param {string[]} argv
 * @param {object} env
 * @param {string} env.PROJECT_CREDS - file of credentials as per [Google Apps Auth][1]
 * @param {string} env.SHEET1_ID - id of SheetSync Google Sheet
 * @param {string} env.GNUCASH_DB - path to GnuCash DB
 * @param {object} io
 * @param {typeof import('fs/promises')} io.fsp
 * @param {(path: string, opts: *) => SqliteDB} io.openSqlite
 * @param {typeof import('google-spreadsheet').GoogleSpreadsheet} io.GoogleSpreadsheet
 * @typedef {import('better-sqlite3').Database} SqliteDB
 *
 * [1]: https://theoephraim.github.io/node-google-spreadsheet/#/getting-started/authentication
 */
const main = async (argv, env, { fsp, openSqlite, GoogleSpreadsheet }) => {
  const config = makeConfig(env);
  const creds = await fsp
    .readFile(config.PROJECT_CREDS, 'utf-8')
    .then(s => JSON.parse(s));

  const doc = new GoogleSpreadsheet(config.SHEET1_ID);

  // Initialize Auth - see
  await doc.useServiceAccountAuth(creds);

  await doc.loadInfo(); // loads document properties and worksheets
  console.log({
    doc: { title: doc.title },
  });

  const opts = argv.includes('-v') ? { verbose: console.log } : {};
  const db = openSqlite(config.GNUCASH_DB, opts);

  const scORM = makeSheetsORM(doc);
  const gcORM = makeORM(db);

  if ('--uncat') {
    await updateGCFromSC(scORM, gcORM);
  } else {
    await matchTxs(scORM, gcORM, { limit: 1396 });
  }
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
      /** @type {any} */ ({ ...process.env }),
      {
        fsp: fsp.default,
        openSqlite: (path, opts) => sqlite3.default(path, opts),
        GoogleSpreadsheet: GoogleSpreadsheet.GoogleSpreadsheet,
      },
    ).catch(err => console.error(err)),
  );
}
