/** asOFX -- render Simple export data as OFX
 *
 * @flow
 */
/*jshint undef: true */
/* globals console */
/* globals require, exports */
'use strict';

const xml2js = require('xml2js');
const xmlb = new xml2js.Builder();

function nopunct(iso /*:string*/) {
    return iso.replace(/[: ZT-]/g, '');
}


/*::
// TODO: move this to lib file so it can be shared
export type STMTTRN = {
    TRNTYPE: 'CREDIT' | 'DEBIT' | 'CHECK';
    DTPOSTED: DateString;
    DTUSER?: DateString;
    TRNAMT: number;
    FITID: string;
    CHECKNUM?: string;
    NAME: string;
    MEMO?: string
}

type DateString = string; //@@ see fmtDate

type Clock = () => Date;
*/

const OFX = function() {
    const institutionInfo = {
        discover: {
            fid: 7101
            , fidOrg: 'Discover Financial Services'
            , url: 'https://ofx.discovercard.com'
            , bankId: null /* not a bank account */
            , accType: 'CREDITCARD'
        },
        // http://www.ofxhome.com/index.php/institution/view/629
        citi: {
            fid: 24909
            , fidOrg: 'Citigroup'
            , url: 'https://www.accountonline.com/cards/svc/CitiOfxManager.do'
            , bankId: null /* not a bank account */
            , accType: 'CREDITCARD'
        },
        amex: {
            fid: 3101
            , fidOrg: 'AMEX'
            , url: 'https://online.americanexpress.com/myca/ofxdl/desktop/desktopDownload.do?request_type=nl_ofxdownload'
            , bankId: null /* not a bank */
            , accType: 'CREDITCARD'
        }
    };


    // cribbed from
    // https://github.com/kedder/ofxstatement/blob/master/src/ofxstatement/ofx.py
    const header = ['<!-- ',
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
                    ''].join('\n');

    const signOn = (clock /*: Clock*/) => ({
        'SIGNONMSGSRSV1':
            {'SONRS': [
                {'STATUS': [
                    {'CODE': '0'},
                    {'SEVERITY': 'INFO'}
                ]},
                {'DTSERVER': nopunct(clock().toISOString())},
                {'LANGUAGE': 'ENG'}
            ]}});

    function parseDate(s /*: string*/) /*: Date */{
        // '20160108170000.000'
        // '20151229050000.000[-7:MST]'
        const syntax = /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\.(\d{3}))?(?:\[([-+])?(\d+(?:\.\d+)?)(?::([a-zA-Z]+))?)?/;

        const int10 = numeral => parseInt(numeral, 10);
        const require = match => { if (match) { return match } else { throw new Error(s); } }
        const msPerHr = 60 * 60 * 1000;
        const withTZ = (d0, sign, hrs) =>
              new Date(d0.getTime() +
                       (hrs ? int10(hrs) * (sign == '-' ? -1 : 1) * msPerHr : 0));

        const [_, yyyy, mm, dd, HH, MM, SS, MS, ts, th] = require(s.match(syntax));
        const [y, m, d, h, min, sec] = [yyyy, mm, dd, HH, MM, SS].map(int10);
        const ms = MS ? int10(MS) / 1000 : 0;
        return withTZ(new Date(Date.UTC(y, m - 1, d, h, min, sec, ms)), ts, th);
    }

    function bankStatement(bank_id /*: string*/, account_id /*: string*/,
                           start_date /*: string*/, end_date /*: string*/, end_balance /*: number*/,
                           txs /*: Array<STMTTRN>*/) {
        return {BANKMSGSRSV1: {
            STMTTRNRS: {
                TRNUID: '0',
                STATUS: {
                    CODE: '0',
                    SEVERITY: 'INFO'
                },
                STMTRS: {
                    CURDEF: 'USD',
                    // TODO: CCACCTFROM
                    BANKACCTFROM: {
                        BANKID: bank_id,
                        ACCTID: account_id,
                        ACCTTYPE: 'CHECKING'
                    },
                    
                    BANKTRANLIST: {
                        DTSTART: start_date,
                        DTEND: end_date,
                        STMTTRN: txs
                    },
                    
                    LEDGERBAL: {
                        BALAMT: end_balance,
                        DTASOF: end_date
                    }}}}};
    }

    function fmtDate(d /*: Date*/) {
        return d.toISOString().substring(0, 20).replace(/[^0-9]/g, '');
    }

    return Object.freeze({
        institutionInfo: institutionInfo,
        header: header,
        signOn: signOn,
        bankStatement: bankStatement,
        fmtDate: fmtDate,
        parseDate: parseDate,
        OFX: (clock /*: Clock */, stmt /*: Object*/) => {
            const document = {
                // Note the order; we don't mutate stmt arg.
                'OFX': Object.assign(signOn(clock), stmt)
            };
            return header + xmlb.buildObject(document);
        }
    });

}();


exports.OFX = OFX;
