/**
 * @flow
 */
/*eslint-disable no-console*/
'use strict';
const Q    = require('q');
const docopt = require('docopt');

const OFX = require('./asOFX').OFX;

const REALM = 'https://www.simple.com/';
const doc = `
Usage:
  simpn download [-q]
  simpn json2ofx JSON OFX
`;


function main(argv, stdout, env, time, fs, mkAccount) {
    const cli = docopt.docopt(doc, {argv: argv.slice(2)});

    const creds = {
        login: () => Q(env.SIMPLE_USERNAME),
        password: () => Q(env.SIMPLE_PASSWORD),
        challenge: q => { throw q; }
    };

    if (cli.download) {
        const d = driver();
        const now = time.clock();
        const start = 0;

        d.download({ account: mkAccount }, creds, start, now)
            .then(exported => stdout.write(JSON.stringify(exported)))
            .done();
    } else if (cli.json2ofx) {
        const input = fs.createReadStream(cli.JSON);
        const write = content => fs.createWriteStream(cli.OFX).write(content);

        let buf = '';
        input.on('data', (chunk) => {
            buf += chunk;
        });
        input.on('end', () => {
            const exported = JSON.parse(buf);
            const s = statement(exported.transactions);
            write(OFX.OFX(time.clock, s));
        });
    }
}


/*::
import type {Driver} from './dldriver';
import type {STMTTRN} from './asOFX';
*/

function driver() /*: Driver*/ {

    function download(aa, creds, _start, _now) {
        console.log('logging in to ', REALM);
        return creds.login().then(
            user => creds.password().then(
                pass => {
                    const acct = aa.account({username: user, password: pass});
                    console.log('fetching transactions as', user);
                    return Q.ninvoke(acct, 'login').then(
                        _ => {
                            console.log('logged in as', user);
                            return Q.ninvoke(acct, 'transactions');
                        });
                }));
    }

    return Object.freeze({
        currency: 'USD',  // Simple is a US bank
        account_type: 'CHECKING', // As of this writing, that's all they offer.
        download: download,
        toOFX: toOFX,
        realm: () => REALM
    });
}

const toOFX = txinfo => Q(txinfo.transactions.map(transaction));

function transaction(tx /*: SimpleTrx*/) /*: STMTTRN */ {
    const recorded = new Date(tx.times.when_recorded);
    const dtposted = nopunct(recorded.toISOString());
    // console.log(dtposted, ' from ', recorded, ' from ', tx.times.when_recorded);
    const dtuser = nopunct(tx.times.when_recorded_local);
    // console.log(dtuser, ' from ', tx.times.when_recorded_local);

    const trnamt = ((tx.bookkeeping_type == 'credit' ? 1 : -1) *
                    toUSD(tx.amounts.amount));
    return {
        TRNTYPE: tx.bookkeeping_type == 'credit' ? 'CREDIT' : 'DEBIT',
        DTPOSTED: dtposted,
        DTUSER: dtuser,
        TRNAMT: trnamt,
        FITID: tx.uuid,
        //TODO? {CHECKNUM: check_no},
        //TODO: {REFNUM: refnum}
        //TODO? BANKACCTTO...
        NAME: tx.description || '',
        MEMO: tx.memo || ''};
}


function statement(stxs /*: Array<SimpleTrx>*/) {
    console.log(stxs.length, 'transactions to statement...');
    const last = (fallback, f) => {
        return stxs.length === 0 ? fallback : f(stxs[stxs.length - 1]);
    };

    const bank_id = last('', t => t.user_id);
    const account_id = bank_id;
    const end_balance = last(0, function(t) {
        return toUSD(t.running_balance);
    });
    const txs = stxs.map(transaction);
    const txdates = txs.map(tx => tx.DTPOSTED);
    const start_date = min(txdates);
    const end_date = max(txdates);
    // console.log('converted to: ', txs.slice(0, 3));

    return OFX.bankStatement(bank_id, account_id,
                             start_date, end_date, end_balance,
                             txs);
}

function toUSD(amt) {
    return amt / 10000;
}

// ack: Linus Unnebäck Nov 18 '12
// http://stackoverflow.com/a/13440842
function min(arr /*: Array<string>*/) {
    return arr.reduce((p, v) => p < v ? p : v );
}

function max(arr /*: Array<string>*/) {
    return arr.reduce((p, v) => p > v ? p : v );
}


/*::
type SimpleTrx = {
    user_id: string;
    uuid: string;
    description: string;
    memo: string;
    running_balance: number;
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

function nopunct(iso /*:string*/) {
    return iso.replace(/[: ZT-]/g, '');
}

if (require.main === module) {
    const fs = require('fs');

    main(
        process.argv,
        process.stdout,
        process.env,
        { clock: () => new Date() },
        { createReadStream: fs.createReadStream,
          createWriteStream: fs.createWriteStream },
        require('bank').account);
}

exports.transaction = transaction;
exports.driver = driver;
