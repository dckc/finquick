/** coinbaseCard -- convert statements to OFX
 */
// @ts-check

'use strict';

const csv = require('csv-parse');
const { textSpanContainsPosition } = require('typescript');
const { OFX } = require('./asOFX.js');

/** @param { string } s */
const parseDate = s => {
  // e.g. 6:02pm 7/31/21
  const parts = s.match(/(\d+):(\d+)(am|pm) (\d+)\/(\d+)\/(\d+)/);
  if (!parts) throw RangeError(s);
  const [ap] = parts.splice(3, 1);
  const [hr12, min, m, d, y] = parts.slice(1, 6).map(n => parseInt(n, 10));
  const hr24 = hr12 + (ap === 'pm' ? 12 : 0);
  const year = 2000 + y;
  return new Date(Date.UTC(year, m - 1, d, hr24, min));
};

const Info = {
  fid: -1, // arbitrary
  fidOrg: 'Coinbase Card',
  url: 'https://www.coinbase.com',
  bankId: 'coinbase.com', // arbitrary
  accType: 'CHECKING',
};

// ack: Linus Unnebäck Nov 18 '12
// http://stackoverflow.com/a/13440842
/** @type { (a: string[]) => string} */
const min = arr => arr.reduce((p, v) => ((p < v ? p : v)));
/** @type { (a: string[]) => string} */
const max = arr => arr.reduce((p, v) => ((p > v ? p : v)));

/**
 * @param { string } text
 * @param { import('./asOFX.js').Clock } clock
 */
const toOFX = async (text, clock) => {
  /** @type { string[][] } */
  const rows = await new Promise((resolve, reject) =>
    csv(text, { relax_column_count: true }, (err, records) =>
      (err ? reject(err) : resolve(records)),
    ),
  );
  console.log('@@csv parsed:', rows.slice(0, 3));
  const purchases = rows
    .filter(([type]) => type === 'Purchase')
    .map(([_ty, NAME, dt, amt, loc]) => {
      const DTPOSTED = OFX.fmtDate(parseDate(dt));
      const TRNAMT = parseFloat(amt.replace(/\$/, ''));
      const FITID = JSON.stringify([DTPOSTED, TRNAMT]);
      /** @type { import('./asOFX.js').STMTTRN } */
      const tx = { TRNTYPE: 'DEBIT', DTPOSTED, TRNAMT, FITID, NAME, MEMO: loc };
      return tx;
    });
  console.log('@@txs:', purchases.slice(0, 3));
  return purchases;
};

/**
 *
 * @param { Readonly<string[]> } args
 * @param {{
 *   stdout: typeof process.stdout,
 *   readFile: typeof import('fs').promises.readFile,
 *   clock: () => Date,
 * }} io
 */
const main = async (args, { stdout, readFile, clock }) => {
  const [downloadedFileName] = args;
  if (!downloadedFileName)
    throw RangeError('Usage: node coinbaseCard.js statement.csv');

  // streaming? overkill.
  const text = await readFile(downloadedFileName, 'utf-8');
  const txs = await toOFX(text, clock);

  const dates = txs.map(t => t.DTPOSTED);
  const endBalance = -1; // todo?
  const statement = OFX.bankStatement(
    Info.bankID,
    Info.accountID,
    min(dates),
    max(dates),
    endBalance,
    txs,
  );
  stdout.write(OFX.OFX(clock, statement));
};

/* global require, module, process */
if (require.main === module) {
  console.log(parseDate('6:02pm 7/31/21'));

  main(process.argv.slice(2), {
    stdout: process.stdout,
    // eslint-disable-next-line global-require
    readFile: require('fs').promises.readFile,
    clock: () => new Date(),
  }).catch(err => console.error(err));
}
