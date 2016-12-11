/**
 * @flow
 */
'use strict';
const Q    = require('q');
const docopt = require('docopt');

const OFX = require('./asOFX').OFX;

const REALM = 'https://www.simple.com/';
const doc = `
Usage:
  simpn download [-q]
  simpn convert IN OUT

Options:
  -q      quiet: do not show browser window
`;


function main(argv, stdout, env, time, fs, getNet) {
    const cli = docopt.docopt(doc, {argv: argv.slice(2)});

    const creds = {
        login: () => Q(env.SIMPLE_USERNAME),
        password: () => Q(env.SIMPLE_PASSWORD),
        challenge: q => { throw q; }
    };

    const debug = !cli['-q'];

    if (cli.download) {
        const net = getNet();
        const d = driver();
        const ua = net.browser({ show: debug });
        const now = time.clock();
        const start = 0;

        d.download(ua, creds, start, now)
            .then(pgData => stdout.write(JSON.stringify(pgData)))
            .then(() => ua.end())
            .done();
    } else if (cli.convert) {
        const input = fs.createReadStream(cli.IN);
        const write = content => fs.createWriteStream(cli.OUT).write(content);

        let buf = '';
        input.on('data', (chunk) => {
            buf += chunk;
        });
        input.on('end', () => {
            const pgModel = JSON.parse(buf);
            const s = statement(pgModel.data);
            write(OFX.OFX(time.clock, s));
        });
    }
}


/*::
// TODO: factor out and share Driver type
type Driver = {
  realm(): string;
  download(ua: Nightmare, creds: Creds,
           start: number, now: Date): Promise<string>;
  toOFX(data: any): Promise<Array<STMTTRN>>
}

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
type DateString = string;

type Creds = {
  login(): Promise<string>;
  password(): Promise<string>;
  challenge(question?: string): Promise<string>;
}

type Nightmare = any; // TODO
*/

function driver() /*: Driver*/ {
    const transactions = Q.async(function *(userAgent, _start, _now){
        // note document below refers to the user agent's document
        console.log('fetching simple.com transactions');
        return yield userAgent
            .evaluate(pageTransactions);
    });

    // Interrogating the page before we have visited it hangs.
    let visited = false;

    const login = Q.async(function*(userAgent, creds /*: Creds*/){
        const nameSel = '.masthead-username';
        // getName is evaluated in the browser; nameSel isn't in scope there.
        const getName =
            () => document.querySelector('.masthead-username').innerText;

        const viz = visited &&
            (yield userAgent.exists(nameSel)) &&
            (yield userAgent.visible(nameSel));

        if (! viz) {
            console.log('logging in to simple.com');
            yield userAgent
                .goto(REALM + 'signin')
                .wait(0.5 * 1000)
                .wait('input#login_username')
                .insert('input#login_username', yield creds.login())
                .insert('input#login_password', yield creds.password())
                .click('input#signin-btn')
                .wait(1.0 * 1000)
                .wait(nameSel);
            visited = true;
        }
        const name = yield userAgent.evaluate(getName);
        console.log('logged in as: ', name);
        return name;
    });

    return Object.freeze({
        currency: 'USD',  // Simple is a US bank
        account_type: 'CHECKING', // As of this writing, that's all they offer.
        download: (ua, creds, start, now) => login(ua, creds)
            .then(_ => transactions(ua, start, now)),
        toOFX: toOFX,
        realm: () => REALM
    });
}

const toOFX = pgModel => Q(pgModel.data.map(transaction));

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
function min/*:: <T>*/(arr /*: Array<T>*/) {
    return arr.reduce((p, v) => p < v ? p : v );
}

function max/*:: <T>*/(arr /*: Array<T>*/) {
    return arr.reduce((p, v) => p > v ? p : v );
}


/*eslint-env browser*/
const pageTransactions = function() {
    return window.Butcher.models.Transactions;
};
/*eslint-env node*/

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
        () => ({ browser: require('nightmare') }));
}

exports.transaction = transaction;
exports.driver = driver;
