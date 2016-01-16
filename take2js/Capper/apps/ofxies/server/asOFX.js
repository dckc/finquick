/** asOFX -- render Simple export data as OFX
 *
 * @flow
 */
/*jshint undef: true */
/* globals console */
/* globals require, exports */
'use strict';

const xml = require('xml');
const docopt = require('docopt');

const doc = `
Usage:
  asOFX IN OUT
`;


/*::
type Access = {
    read(which: string): stream$Readable;
    write(which: string): stream$Writable
};
*/

function main(cli/*: Access*/, clock/*: () => Date*/) {
    const input = cli.read('IN');
    const output = cli.write('OUT');
    let buf = '';
    input.on('data', (chunk) => {
        buf += chunk;
    });
    input.on('end', () => {
        const data = JSON.parse(buf).data;
        output.write(OFX.OFX(clock, Simple.statement(data)));
    });
}

/*::
type SimpleTrx = {
    uuid: string;
    description: string;
    memo: string;
    times: {
      when_recorded: number;
      when_recorded_local: string
    };
    bookkeeping_type: 'credit' | 'debit';
    amounts: {
        amount: number
    }
}
*/

const Simple = function() {

    const transaction = (tx /*: SimpleTrx*/) => {
        const recorded = new Date(tx.times.when_recorded);
        const dtposted = nopunct(recorded.toISOString());
        console.log(dtposted, ' from ', recorded, ' from ', tx.times.when_recorded);
        const dtuser = nopunct(tx.times.when_recorded_local);
        console.log(dtuser, ' from ', tx.times.when_recorded_local);

        const trnamt = ((tx.bookkeeping_type == 'credit' ? 1 : -1) *
                        Simple.toUSD(tx.amounts.amount));
        return {STMTTRN: [
            {TRNTYPE: tx.bookkeeping_type.toUpperCase()},
            {DTPOSTED: dtposted},
            {DTUSER: dtuser},
            {TRNAMT: trnamt},
            {FITID: tx.uuid},
            //TODO? {CHECKNUM: check_no},
            {NAME: tx.description || ''},
            {MEMO: tx.memo || ''}
            //TODO: {REFNUM: refnum}
            //TODO? BANKACCTTO...
        ]};
    };


    const statement = (stxs) => {
        const last = (fallback, f) => {
            return stxs.length === 0 ? fallback : f(stxs[stxs.length - 1]);
        };

        const bank_id = last('', function(t) { return t.user_id; });
        const account_id = bank_id;
        const end_balance = last(0, function(t) {
            return Simple.toUSD(t.running_balance);
        });
        const txs = stxs.map(transaction);
        const txdates = txs.map(function(tx) { return tx.DTPOSTED; });
        const start_date = min(txdates);
        const end_date = max(txdates);

        return {BANKMSGSRSV1: [
            {STMTTRNRS: [
                {TRNUID: '0'},
                {STATUS: [
                    {CODE: '0'},
                    {SEVERITY: 'INFO'}]},
                
                {STMTRS: [
                    {CURDEF: Simple.currency},
                    // sometimes CCACCTFROM
                    {BANKACCTFROM: [
                        {BANKID: bank_id},
                        {ACCTID: account_id},
                        {ACCTTYPE: Simple.account_type}]},
                    
                    {BANKTRANLIST: [
                        {DTSTART: start_date},
                        {DTEND: end_date}].concat(txs)},
                    
                    {LEDGERBAL: [
                        {BALAMT: end_balance},
                        {DTASOF: end_date}]}
                ]}]}]};
    };

    return Object.freeze({
        currency: 'USD',  // Simple is a US bank
        account_type: 'CHECKING', // As of this writing, that's all they offer.
        toUSD: function(amt) { return amt / 10000; },
        transaction: transaction,
        statement: statement
    });
}();


function nopunct(iso /*:string*/) {
    return iso.replace(/[: ZT-]/g, '');
}


/*::
type Transaction = {
    TRNTYPE: 'CREDIT' | 'DEBIT';
    DTPOSTED: Date;
    DTUSER: Date;
    TRNAMT: number;
    FITID: string;
    CHECKNUM: ?string,
    NAME: string
}
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
        amex: {
            fid: 3101
            , fidOrg: 'American Express Card'
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

    return Object.freeze({
        institutionInfo: institutionInfo,
        header: header,
        signOn: signOn,
        fmtDate: d => d.toISOString().substring(0, 20).replace(/[^0-9]/g, ''),
        parseDate: parseDate,
        OFX: (clock, stmt) => {
            const document = {
                'OFX': [signOn(clock)].concat(stmt)
            };
            return header + xml(document);
        }
    });

}();


// ack: Linus Unnebäck Nov 18 '12
// http://stackoverflow.com/a/13440842
function min(arr) {
    return arr.reduce(function (p, v) {
        return ( p < v ? p : v );
    });
}

function max(arr) {
    return arr.reduce(function (p, v) {
        return ( p > v ? p : v );
    });
}


function CLI(argv /*: Array<string> */,
             createReadStream /*: (path: string) => stream$Readable */,
             createWriteStream /*: (path: string) => stream$Writable */)/*: Access*/
{
    const opt = docopt.docopt(doc, {argv: argv.slice(2)});
    return {
        // TODO: refactor as creating a new object that has an openrd() method
        read: function(which) {
            return createReadStream(opt[which]);
        },
        write: function(which) {
            return createWriteStream(opt[which]);
        }
    };
}

exports.Simple = Simple;
exports.OFX = OFX;
exports.CLI = CLI;
exports.main = main;

if (process.env.TESTING) {
    (function () {
        const fs = require('fs');
        const clock = () => new Date();
        const cli = CLI(process.argv,
                        fs.createReadStream, fs.createWriteStream);
        main(cli, clock);
    })();
}
