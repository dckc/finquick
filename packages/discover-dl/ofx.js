// @ts-check
/* eslint-disable import/no-extraneous-dependencies */
import * as jstoxml from 'jstoxml';

const { toXML } = jstoxml.default;

/**
 * @typedef {{ STMTTRN: {
 *     TRNTYPE: 'CREDIT' | 'DEBIT' | 'CHECK';
 *     DTPOSTED: DateString;
 *     DTUSER?: DateString;
 *     FITID: string;
 *     NAME: string;
 *     TRNAMT: number;
 *     CHECKNUM?: string;
 *     MEMO?: string
 * }}} STMTTRN
 */

/**
 * cribbed from
 * https://github.com/kedder/ofxstatement/blob/master/src/ofxstatement/ofx.py
 */
export const header = [
  '<!-- ',
  'OFXHEADER:100',
  'DATA:OFXSGML',
  'VERSION:102',
  'SECURITY:NONE',
  'ENCODING:UTF-8',
  'CHARSET:NONE',
  'COMPRESSION:NONE',
  'OLDFILEUID:NONE',
  'NEWFILEUID:NONE',
  '-->',
  '',
  '',
].join('\n');

/**
 * @see {fmtDate}
 * @typedef {string} DateString
 */

/**
 * @param {Date} d
 * @returns {DateString}
 */
export const fmtDate = d =>
  d
    .toISOString()
    .substring(0, 20)
    .replace(/[^0-9]/g, '');

function nopunct(iso) {
  return iso.replace(/[: ZT-]/g, '');
}

/**
 *
 * @param {Date} dtServer
 */
export const signOn = dtServer => ({
  SIGNONMSGSRSV1: {
    SONRS: [
      { STATUS: [{ CODE: '0' }, { SEVERITY: 'INFO' }] },
      { DTSERVER: nopunct(dtServer.toISOString()) },
      { LANGUAGE: 'ENG' },
    ],
  },
});

/**
 * @param {string} accountId
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {number} endBalance
 * @param {STMTTRN[]} txs
 */
export const ccStatement = (accountId, startDate, endDate, endBalance, txs) => {
  return {
    CREDITCARDMSGSRSV1: {
      CCSTMTTRNRS: {
        TRNUID: '0',
        STATUS: {
          CODE: '0',
          SEVERITY: 'INFO',
        },
        CCSTMTRS: {
          CURDEF: 'USD',
          CCACCTFROM: {
            ACCTID: accountId,
          },

          BANKTRANLIST: [
            { DTSTART: fmtDate(startDate) },
            { DTEND: fmtDate(endDate) },
            txs,
          ],

          LEDGERBAL: {
            BALAMT: endBalance,
            DTASOF: fmtDate(endDate),
          },
        },
      },
    },
  };
};

/**
 *
 * @param {Date} dtServer
 * @param {ReturnType<ccStatement>} stmt
 */
export const OFX = (dtServer, stmt) => {
  const document = {
    OFX: { ...signOn(dtServer), ...stmt },
  };
  return header + toXML(document, { indent: '  ' });
};
