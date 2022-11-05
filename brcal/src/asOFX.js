/** asOFX -- render Simple export data as OFX
 *
 */
/* global require */
// @ts-check

'use strict';

const xml2js = require('xml2js');

const xmlb = new xml2js.Builder();

const { freeze } = Object;

function nopunct(/** @type { string } */ iso) {
  return iso.replace(/[: ZT-]/g, '');
}

/**
@typedef {{
    TRNTYPE: 'CREDIT' | 'DEBIT' | 'CHECK';
    DTPOSTED: DateString;
    DTUSER?: DateString;
    TRNAMT: number;
    FITID: string;
    CHECKNUM?: string;
    NAME: string;
    MEMO?: string
}} STMTTRN;
 
@typedef { string } DateString; // see fmtDate
 
@typedef { () => Date } Clock;
 */

const OFX = (() => {
  const institutionInfo = {
    discover: {
      fid: 7101,
      fidOrg: 'Discover Financial Services',
      url: 'https://ofx.discovercard.com',
      bankId: null /* not a bank account */,
      accType: 'CREDITCARD',
    },
    // http://www.ofxhome.com/index.php/institution/view/629
    citi: {
      fid: 24909,
      fidOrg: 'Citigroup',
      url: 'https://www.accountonline.com/cards/svc/CitiOfxManager.do',
      bankId: null /* not a bank account */,
      accType: 'CREDITCARD',
    },
    amex: {
      fid: 3101,
      fidOrg: 'AMEX',
      url: 'https://online.americanexpress.com/myca/ofxdl/desktop/desktopDownload.do?request_type=nl_ofxdownload',
      bankId: null /* not a bank */,
      accType: 'CREDITCARD',
    },
  };

  // cribbed from
  // https://github.com/kedder/ofxstatement/blob/master/src/ofxstatement/ofx.py
  const header = [
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

  const signOn = (/** @type { Clock } */ clock) => ({
    SIGNONMSGSRSV1: {
      SONRS: [
        { STATUS: [{ CODE: '0' }, { SEVERITY: 'INFO' }] },
        { DTSERVER: nopunct(clock().toISOString()) },
        { LANGUAGE: 'ENG' },
      ],
    },
  });

  /**
   * @param { string } s
   * @returns { Date }
   */
  function parseDate(s) {
    // '20160108170000.000'
    // '20151229050000.000[-7:MST]'
    const syntax =
      /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\.(\d{3}))?(?:\[([-+])?(\d+(?:\.\d+)?)(?::([a-zA-Z]+))?)?/;

    const int10 = numeral => parseInt(numeral, 10);
    const the = match => {
      if (match) {
        return match;
      } else {
        throw new Error(s);
      }
    };
    const msPerHr = 60 * 60 * 1000;
    const withTZ = (d0, sign, hrs) =>
      new Date(
        d0.getTime() +
          (hrs ? int10(hrs) * (sign === '-' ? -1 : 1) * msPerHr : 0),
      );

    const [_, yyyy, mm, dd, HH, MM, SS, MS, ts, th] = the(s.match(syntax));
    const [y, m, d, h, min, sec] = [yyyy, mm, dd, HH, MM, SS].map(int10);
    const ms = MS ? int10(MS) / 1000 : 0;
    return withTZ(new Date(Date.UTC(y, m - 1, d, h, min, sec, ms)), ts, th);
  }

  /**
   * @param {string} bankID
   * @param {string} accountID
   * @param {string} startDate
   * @param {string} endDate
   * @param {number} endBalance
   * @param {STMTTRN[]} txs
   */
  function bankStatement(
    bankID,
    accountID,
    startDate,
    endDate,
    endBalance,
    txs,
  ) {
    const bank = false;
    return {
      BANKMSGSRSV1: {
        STMTTRNRS: {
          TRNUID: '0',
          STATUS: {
            CODE: '0',
            SEVERITY: 'INFO',
          },
          STMTRS: {
            CURDEF: 'USD',
            ...(bank
              ? {
                  BANKACCTFROM: {
                    BANKID: bankID,
                    ACCTID: accountID,
                    ACCTTYPE: 'CHECKING',
                  },
                }
              : {
                  // TODO: CCACCTFROM
                  CCACCTFROM: {
                    ACCTID: accountID,
                  },
                }),

            BANKTRANLIST: {
              DTSTART: startDate,
              DTEND: endDate,
              STMTTRN: txs,
            },

            LEDGERBAL: {
              BALAMT: endBalance,
              DTASOF: endDate,
            },
          },
        },
      },
    };
  }

  /** @param { Date } d */
  function fmtDate(d) {
    return d
      .toISOString()
      .substring(0, 20)
      .replace(/[^0-9]/g, '');
  }

  return freeze({
    institutionInfo,
    header,
    signOn,
    bankStatement,
    fmtDate,
    parseDate,
    /**
     *
     * @param { Clock } clock
     * @param { ReturnType<typeof bankStatement> } stmt
     */
    OFX: (clock, stmt) => {
      const document = {
        OFX: freeze({ ...signOn(clock), ...stmt }),
      };
      return header + xmlb.buildObject(document);
    },
  });
})();

/* global module */
module.exports = { OFX };
