// @ts-check
const { OFX } = require('./asOFX.js');

const Usage = `lmtoOFX DB acctCode startDate`;

const { freeze } = Object;

/** @param {string} msg */
const fail = msg => {
  throw Error(msg);
};

const example = {
  tx: {
    id: 128394674,
    date: '2022-10-01',
    authorized_date: null,
    original_date: null,
    payee: 'BigBiz',
    amount: '1.0000',
    currency: 'usd',
    notes: null,
    category_id: null,
    recurring_id: null,
    asset_id: null,
    plaid_account_id: 1234,
    status: 'uncleared',
    is_group: false,
    group_id: null,
    parent_id: null,
    tags: null,
    external_id: null,
    original_name: 'BIG BIZ',
    type: null,
    subtype: null,
    fees: null,
    price: null,
    quantity: null,
  },
};

/** @param {typeof example.tx} tx */
const lmToOFX = tx => {
  const sign = -1; // credit card
  const TRNAMT = sign * Number(tx.amount);
  /** @type { import('./asOFX.js').STMTTRN } */
  const ofx = {
    TRNTYPE: TRNAMT < 0 ? 'CREDIT' : 'DEBIT',
    DTPOSTED: OFX.fmtDate(new Date(tx.date)),
    TRNAMT,
    FITID: `${tx.id}`,
    NAME: tx.payee,
    ...(tx.notes ? { MEMO: tx.notes } : {}),
  };
  return ofx;
};

/**
 * @param {SqliteDB} db
 */
const makeLunchMoneyTool = db => {
  /**
   * @param {number|string} id
   * @param {Date} start
   */
  const getPlaidTransactions = (id, start) => {
    const stmt = db.prepare(
      `select * from (select * from slots where name = ?) slot
       where slot.string_val->>'$.plaid_account_id' = ?
       and slot.string_val->>'$.date' >= ?`,
    );
    return stmt
      .all('lunchmoney.app/transactions', id, start.toISOString().slice(0, 10))
      .map(({ string_val }) => JSON.parse(string_val));
  };
  return freeze({ getPlaidTransactions });
};

const myInstitutions = {
  2110: {
    ...OFX.institutionInfo.discover,
    accountID: 'Discovr86X43X5999X8146',
  },
};

/** @param {string} notes */
const extractLMid = notes => {
  const parts = notes.match(/lm:(?<id>\d+)/);
  if (!parts) fail(`cannot find lunchmoney id: ${notes}`);
  return Number(parts?.groups?.id);
};

/**
 * @param {SqliteDB} db
 */
const makeGnuCashTool = db => {
  const getStringSlot = (obj_guid, name) => {
    const slot = db
      .prepare(`select string_val from slots where obj_guid = ? and name = ?`)
      .get(obj_guid, name);
    return slot.string_val;
  };

  /** @param {string|number} code */
  const getAccountByCode = code => {
    const stmt = db.prepare('select * from accounts where code = ?');
    const acct = stmt.get(code);
    acct || fail(`not found: ${code}`);
    const notes = getStringSlot(acct.guid, 'notes');
    return { ...acct, notes };
  };

  return freeze({ getAccountByCode });
};

// ack: Linus Unnebäck Nov 18 '12
// http://stackoverflow.com/a/13440842
/** @type { (a: string[]) => string} */
const min = arr => arr.reduce((p, v) => (p < v ? p : v));
/** @type { (a: string[]) => string} */
const max = arr => arr.reduce((p, v) => (p > v ? p : v));

/**
 * @param { string[] } args
 * @param {{
 *   openSqlite: (path: string) => SqliteDB
 *   stdout: typeof process.stdout,
 *   clock: () => Date,
 * }} io
 * @typedef {import('better-sqlite3').Database} SqliteDB
 */
const main = async (args, { openSqlite, stdout, clock }) => {
  const [filename, code, start] = args;
  if (!(filename && code && start)) {
    throw Error(Usage);
  }
  const db = openSqlite(filename);
  const gc = makeGnuCashTool(db);
  const acct = gc.getAccountByCode(code);
  const Info = myInstitutions[code] || fail(`no instituion info for ${code}`);
  //   console.debug(acct);
  const id = extractLMid(acct.notes);
  //   console.debug({ id });
  const lm = makeLunchMoneyTool(db);
  const txsLM = lm.getPlaidTransactions(id, new Date(start));
  //   console.debug(txs.slice(0, 2));
  const txsOFX = txsLM.map(lmToOFX);
  //   console.debug(ofx.slice(0, 20));

  const dates = txsLM.map(t => t.DTPOSTED);
  const endBalance = -1; // todo?
  const statement = OFX.bankStatement(
    Info.bankID,
    Info.accountID,
    min(dates),
    max(dates),
    endBalance,
    txsOFX,
  );
  stdout.write(OFX.OFX(clock, statement));
};

/* global require, module, process */
if (require.main === module) {
  main(process.argv.slice(2), {
    // eslint-disable-next-line global-require
    openSqlite: path => require('better-sqlite3')(path),
    stdout: process.stdout,
    clock: () => new Date(),
  }).catch(err => console.error(err));
}
