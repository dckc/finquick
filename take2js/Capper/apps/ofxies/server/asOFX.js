/** asOFX -- render Simple export data as OFX
 *
 * @flow
 */
/*jshint undef: true */
/* globals console */
/* globals require, exports */
var xml = require('xml');

// TODO: use `Usage...` and an ES6 transpiler such as babel
var doc = [
    'Usage:',
    ' csv2ofx IN OUT',
].join('\n');

var docopt = require('docopt');

/*::
  import type {Readable, Writeable} from 'stream2';

  type Access = {
  read(which: string): Readable;
  write(which: string): Writeable
  };
*/

function main(cli/*: Access*/, clock/*: () => Date*/) {
    var input = cli.read('IN');
    var output = cli.write('OUT');
    input.on('data', function(chunk) {
        var data = JSON.parse(chunk.toString());
        output.write(asOFX(clock, data));
    });
}

var Simple = {
    currency: 'USD',  // Simple is a US bank
    account_type: 'CHECKING', // As of this writing, that's all they offer.
    toUSD: function(amt) { return amt / 10000; }
};


function asOFX(clock, exp) {
    // cribbed from
    // https://github.com/kedder/ofxstatement/blob/master/src/ofxstatement/ofx.py
    var header = ['<!-- ',
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


    function signOn() {
        return {
            'SIGNONMSGSRSV1': [
                {'SONRS': [
                    {'STATUS': [
                        {'CODE': '0'},
                        {'SEVERITY': 'INFO'}
                    ]},
                    {'DTSERVER': nopunct(clock().toISOString())},
                    {'LANGUAGE': 'ENG'}
                ]}]};
    }
    var last = function(fallback, f) {
        var txs = exp.transactions;
        return txs.length === 0 ? fallback : f(txs[txs.length - 1]);
    };

    var transactionList = function() {
        var bank_id = last('', function(t) { return t.user_id; });
        var account_id = bank_id;
        var end_balance = last(0, function(t) {
            return Simple.toUSD(t.running_balance);
        });
        var txs = exp.transactions.map(transaction);
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

    var transaction = function(tx) {
        var recorded = new Date(tx.times.when_recorded);
        var dtposted = nopunct(recorded.toISOString());
        console.log(dtposted, ' from ', recorded, ' from ', tx.times.when_recorded);
        var dtuser = nopunct(tx.times.when_recorded_local);
        console.log(dtuser, ' from ', tx.times.when_recorded_local);

        var trnamt = ((tx.bookkeeping_type == 'credit' ? 1 : -1) *
                      Simple.toUSD(tx.amounts.amount));
        return {STMTTRN: [
            {TRNTYPE: tx.bookkeeping_type.toUpperCase()},
            {DTPOSTED: dtposted},
            {DTUSER: dtuser},
            {TRNAMT: trnamt},
            {FITID: tx.uuid},
            //TODO? {CHECKNUM: check_no},
            {NAME: tx.description || ''},
            {MEMO: tx.memo || ''},
            //TODO: {REFNUM: refnum}
            //TODO? BANKACCTTO...
        ]};
    };

    var document = {'OFX': [signOn()].concat(transactionList()) };

    return header + xml(document);
}


function nopunct(iso) {
    return iso.replace(/[: ZT-]/g, '');
}

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


function CLI(argv /*: Array<String> */,
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

exports.CLI = CLI;
exports.main = main;

