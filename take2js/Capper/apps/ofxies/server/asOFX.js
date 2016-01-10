/** asOFX -- render Simple export data as OFX
 *
 * @flow
 */
/*jshint undef: true */
/* globals console */
/* globals require, exports */
var xml = require('xml');
var docopt = require('docopt');

var doc = `
Usage:
  asOFX IN OUT
`;


/*::
  import type {Readable, Writeable} from 'stream2';

  type Access = {
  read(which: string): Readable;
  write(which: string): Writeable
  };
*/

function main(cli/*: Access*/, clock/*: () => Date*/) {
    const input = cli.read('IN');
    const output = cli.write('OUT');
    var buf = '';
    input.on('data', (chunk) => {
        buf += chunk;
    });
    input.on('end', () => {
        const data = JSON.parse(buf).data;
        output.write(OFX.OFX(clock, Simple.statement(data)));
    });
}

const Simple = function() {

    const transaction = (tx) => {
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

        var bank_id = last('', function(t) { return t.user_id; });
        var account_id = bank_id;
        var end_balance = last(0, function(t) {
            return Simple.toUSD(t.running_balance);
        });
        var txs = stxs.map(transaction);
        var txdates = txs.map(function(tx) { return tx.DTPOSTED; });
        var start_date = min(txdates);
        var end_date = max(txdates);

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


function nopunct(iso) {
    return iso.replace(/[: ZT-]/g, '');
}



const OFX = function() {
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

    return Object.freeze({
        header: header,
        signOn: signOn,
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
             createReadStream /*: (path: string) => Readable */,
             createWriteStream /*: (path: string) => Writeable */)/*: Access*/
{
    var opt = docopt.docopt(doc, {argv: argv.slice(2)});
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
