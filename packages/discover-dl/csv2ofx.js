// @ts-check
// grr... eslint doesn't grok "exports" in package.json???
/* eslint-disable import/no-unresolved */
import { parse } from 'csv-parse/sync';
import { OFX, ccStatement, fmtDate } from './ofx.js';

const { isArray } = Array;
const { keys } = Object;
const { stringify: lit } = JSON;

// eslint-disable-next-line no-unused-vars
export const example = {
  record: {
    'Trans. Date': '07/14/2023',
    'Post Date': '07/14/2023',
    Description: 'TEAS',
    Amount: '31.00',
    Category: 'Supermarkets',
  },
};
/** @typedef {typeof example.record} DiscoverExport */

// ack: Linus Unnebäck Nov 18 '12
// http://stackoverflow.com/a/13440842
/** @type { <ORD extends number|string>(a: ORD[]) => ORD } */
const min = arr => arr.reduce((p, v) => (p < v ? p : v));
/** @type { <ORD extends number|string>(a: ORD[]) => ORD } */
const max = arr => arr.reduce((p, v) => (p > v ? p : v));

/** @type {(xs: unknown[], ys: unknown[]) => boolean} */
const arrayEqual = (xs, ys) =>
  isArray(xs) &&
  isArray(ys) &&
  xs.length === ys.length &&
  xs.every((x, ix) => x === ys[ix]);

/** @param {string} s */
const hashCode = s => {
  let hash = 0;
  let i;
  let chr;
  if (s.length === 0) return hash;
  for (i = 0; i < s.length; i += 1) {
    chr = s.charCodeAt(i);
    // eslint-disable-next-line no-bitwise
    hash = (hash << 5) - hash + chr;
    // eslint-disable-next-line no-bitwise
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

const datePatt = /(?<mm>\d{2})\/(?<dd>\d{2})\/(?<yyyy>\d{4})/;

const parseDate = mdy => {
  const m = datePatt.exec(mdy);
  if (!(m && m.groups)) throw RangeError(mdy);
  const { mm, dd, yyyy } = m.groups;
  return new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10));
};

/**
 * @param {string} acctId
 * @param {import('./csv2ofx.js').DiscoverExport[]} records
 */
const toStatement = (acctId, records) => {
  /** @type {import('./ofx').STMTTRN[]} */
  const txs = records.map(
    ({
      'Trans. Date': txDate,
      'Post Date': postDate,
      Description: NAME,
      Amount: amt,
      Category: cat,
    }) => ({
      STMTTRN: {
        DTPOSTED: fmtDate(parseDate(postDate)),
        FITID: `${parseDate(postDate)
          .toISOString()
          .slice(0, 10)}-${amt}-${hashCode(NAME)}`,
        NAME,
        TRNAMT: -parseFloat(amt),
        TRNTYPE: parseFloat(amt) > 0 ? 'DEBIT' : 'CREDIT',
        DTUSER: fmtDate(parseDate(txDate)),
        MEMO: cat,
      },
    }),
  );
  const millis = records.map(r => parseDate(r['Post Date']).valueOf());
  const dtStart = new Date(min(millis));
  const dtEnd = new Date(max(millis));
  const endBalance = 0; // ???
  const stmt = ccStatement(acctId, dtStart, dtEnd, endBalance, txs);
  return stmt;
};

/**
 * @param {object} opts
 * @param {string} opts.acctId
 * @param {Date} [opts.dtServer]
 * @param {string} [opts.content]
 * @param {DiscoverExport[]} [opts.records]
 * @param {object} io
 * @param {() => number} [io.now]
 */
export const csv2ofx = (opts, io = {}) => {
  const { now = () => new Date().getTime() } = io;
  const {
    acctId,
    dtServer = new Date(now()),
    content,
    /** @type {DiscoverExport[]} */
    records = parse(content, { columns: true }),
  } = opts;
  console.log('records:', records.length, keys(records[0]));
  if (records.length === 0) throw Error(`no records`);
  if (!arrayEqual(keys(records[0]), keys(example.record))) {
    throw Error(
      `expected ${lit(keys(example.record))} got ${lit(keys(records[0]))}`,
    );
  }
  const stmt = toStatement(acctId, records);
  const ofx = OFX(dtServer, stmt);
  return ofx;
};
