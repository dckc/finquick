/** asOFX -- render Simple export data as OFX
 *
 * @flow
 */
/*jshint undef: true */
/* globals console */
/* globals require, exports */
'use strict';

const xml = require('xml');

function nopunct(iso /*:string*/) {
    return iso.replace(/[: ZT-]/g, '');
}


/*::
// TODO: move this to lib file so it can be shared
type STMTTRN = {
    TRNTYPE: 'CREDIT' | 'DEBIT';
    DTPOSTED: DateString;
    DTUSER?: DateString;
    TRNAMT: number;
    FITID: string;
    CHECKNUM?: string,
    NAME: string
}

type DateString = string; //@@ see fmtDate

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

    const signOn = (clock) => ({
        'SIGNONMSGSRSV1': [
            {'SONRS': [
                {'STATUS': [
                    {'CODE': '0'},
                    {'SEVERITY': 'INFO'}
                ]},
                {'DTSERVER': nopunct(clock().toISOString())},
                {'LANGUAGE': 'ENG'}
            ]}]});

    function parseDate(s) {
        // '20160108170000.000'
        // '20151229050000.000[-7:MST]'
        const syntax = /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\.(\d{3}))?(?:\[([-+])?(\d+(?:\.\d+)?)(?::([a-zA-Z]+))?)?/;
        const parts = s.match(syntax);
        const n = i => Number(parts[i]);
        const d0 = new Date(n(1), n(2) - 1, n(3),
                            n(4), n(5), n(6),
                            parts[7] ? n(7) / 1000 : 0);
        const sign = parts[8] == '-' ? -1 : 1;
        const msPerHr = 60 * 1000;
        const offset = parts[9] ? n(9) * sign * msPerHr : 0;
        return new Date(d0.getTime() + offset);
    }

    function bankStatement(bank_id, account_id,
                           start_date, end_date, end_balance,
                           txs /*: Array<STMTTRN>*/) {
        return {BANKMSGSRSV1: [
            {STMTTRNRS: [
                {TRNUID: '0',
                 STATUS: [
                    {CODE: '0',
                     SEVERITY: 'INFO'}],
                
                 STMTRS: [
                    {CURDEF: 'USD',
                    // TODO: CCACCTFROM
                     BANKACCTFROM: [
                        {BANKID: bank_id},
                        {ACCTID: account_id},
                        {ACCTTYPE: 'CHECKING'}],
                    
                     BANKTRANLIST: [
                        {DTSTART: start_date,
                         DTEND: end_date,
                         STMTTRN: txs}],
                    
                     LEDGERBAL: [
                        {BALAMT: end_balance,
                         DTASOF: end_date}]
                     }]}]}]};
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
        OFX: (clock, stmt) => {
            const document = {
                'OFX': [signOn(clock)].concat(stmt)
            };
            return header + xml(document);
        }
    });

}();


exports.OFX = OFX;
