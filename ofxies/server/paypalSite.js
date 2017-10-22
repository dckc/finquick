/**
@flow
*/
/*eslint-disable no-console*/
'use strict';
const Q    = require('q');
const docopt = require('docopt').docopt;
const csvp = require('csv-parse');

const freedesktop = require('./secret-tool');
const asOFX = require('./asOFX');
const OFX = asOFX.OFX;

const REALM = 'https://www.paypal.com/';
const usage = `
Usage:
  paypalSite.js download --login=EMAIL --output=FILE [-r URL] [-q] [-w N]
  paypalSite.js convert --login=EMAIL CSV OFX
  paypalSite.js -h | --help

Options:
 -l M --login=EMAIL     Login email
 -r URL --realm=URL     Realm of Chrome password entry in freedesktop
                        secret store (aka gnome keychain)
                        [default: ${REALM}]
 -o FILE --output=FILE  where to save CSV data
 -q                     quiet: do not show browser window
 -w N                   timeout in seconds [default: 20]
 -h --help              show usage

We look up the login password using the 'signon_realm' attribute,
following Chrome conventions.

`;



function main(argv, time, proc, fs, net) {
    'use strict';
    const cli = docopt(usage, { argv: argv.slice(2) });

    if (cli['download']) {
        download(cli, time.clock(), net, fs,
                 freedesktop.makeSecretTool(proc.spawn));
    } else if (cli['convert']) {
        convert(cli.CSV, cli.OFX, cli['--login'], time, fs)
    }
}


function download(cli, now, net, fs, keyChain) {
    const creds = {
        login: () => Q(cli['--login']),
        password: () => keyChain.lookup({signon_realm: cli['--realm']})
    };
    const ua = net.browser(
        { show: !cli['-q'],
          waitTimeout: parseInt(cli['-w']) * 1000 });
    const save = data => Q.nfcall(fs.writeFile, cli['--output'], data);

    const d = driver();
    d.download(ua, creds, daysBefore(90, now), now)
        .then(save)
        .then(() => ua.end())
        .done();
}


function daysBefore(n, d) {
    const msPerDay = 24 * 60 * 60 * 1000;
    return new Date(d.getTime() - n * msPerDay);
}


function convert(csv, ofx, email, time, fs) {
    const input = fs.createReadStream(csv);
    const write = content => fs.createWriteStream(ofx).write(content);
    let buf = '';
    input
        .on('data', chunk => buf += chunk)
        .on('end', () => toOFX(buf).then(txs => {
            console.log(`converted ${txs.length} transactions`);
            const stmt = statement(txs, email);
            write(OFX.OFX(time.clock, stmt));
        }).done());
}

/*::

import type {Driver} from './dldriver';

import type {STMTTRN} from './asOFX';

type Transaction = {
  ID: string,
  Date: Date,
  Name: string,
  Status: string,
  Note: string,
  Net: number
};



type Nightmare = any; // TODO
*/

function driver() /*: Driver */ {
    function download(ua, creds, start, now) {
        return login(ua, creds)
            .then(session => session.downloadActivity(start, now));
    }

    const login = Q.async(function*(userAgent, creds){
        console.log('login()...');

        yield userAgent
            .goto(REALM + 'signin/')
            .wait(1 * 1000)
            .wait('section#login')
            .insert('#login input[name="login_email"]', '')
            .insert('#login input[name="login_email"]',
                    yield creds.login())
            .insert('#login input[name="login_password"]', '')
            .insert('#login input[name="login_password"]',
                    yield creds.password())
            .click('#btnLogin')
            .wait(2 * 1000) // wait for page load
            .wait('body');


        const downloadActivity = Q.async(function*(startDate, endDate) {
            const exportItem =
                '.nemo_statementsLinkMenu li:nth-child(2) a';
            yield userAgent
                .wait('#activityModuleHeaderCompleted a.moduleHeaderLink')
                .click('#activityModuleHeaderCompleted a.moduleHeaderLink')
                .wait(1 * 1000)
                .wait('a#ddDownload')
                .click('a#ddDownload')
                .wait(0.2 * 1000)
                .click(exportItem)
                .wait(3 * 1000)
                .wait('form[name="form1"]')
                .select('form[name="form1"] select[name="custom_file_type"]',
                        'comma_balaffecting')
                .click('form[name="form1"] input[value="custom_date_range"]');

            const dateBounds = { from: startDate, to: endDate };
            const dateCol = { from: 3, to: 7 };
            const dateSel = (bound /*: 'from' | 'to' */,
                             field /*: 'month' | 'day' | 'year' */) =>
                  `td.dateFields table tbody tr
                   td:nth-child(${dateCol[bound]}) input.field_${field}`;
            for (let which of ['from', 'to']) {
                const d = new Date(dateBounds[which]);
                const vals = { month: d.getMonth() + 1,
                               day: d.getDate(),
                               year: d.getFullYear() };
                for (let field of ['month', 'day', 'year']) {
                    yield userAgent
                        .insert(dateSel(which, field), '')
                        .insert(dateSel(which, field), vals[field]);
                }
            }

            yield userAgent
                .wait(2 * 1000)
                .wait('form[name="form1"]');
            console.log('Evaluating XHR function...');
                
            const response = yield userAgent.evaluate(requestDownload);
            if (!response) {
                throw 'no response from requestDownload!';
            }
            console.log('XHR response:', response.status, response.statusText);
            if (response.status === 200) {
                return response.responseText;
            } else {
                throw new Error(response.statusText);
            }
        });

        return Object.freeze({
            downloadActivity: downloadActivity
        });
    });

    return Object.freeze({
        realm: () => REALM,
        download: download,
        toOFX: toOFX
    });
}


function statement(txs, account_id) {
    // ISSUE: copy-and-paste from simple
    console.log(txs.length, 'transactions to statement...');
    const min = arr => arr.reduce((p, v) => p < v ? p : v );
    const max = arr => arr.reduce((p, v) => p > v ? p : v );

    const bank_id = account_id;
    const end_balance = 0;
    const txdates = txs.map(tx => tx.DTPOSTED);
    const start_date = min(txdates);
    const end_date = max(txdates);

    return OFX.bankStatement(bank_id, account_id,
                             start_date, end_date, end_balance,
                             txs);
}


function toOFX(data) {
    /*:: type TxMaker = (row: Array<string>) => Transaction */
    function record(hd /*: Array<string>*/) /*: TxMaker*/{
        const field = name => (row => {
            const ix = hd.indexOf(name);
            if (ix < 0 || ix + 1 > row.length) {
                throw new Error(name);
            }
            return row[ix];
        });
        
        const ID = field('Transaction ID');
        const Date = field('Date');
        const Name = field('Name');
        const Status = field('Status');
        const Note = field('Note');
        const Net = field('Net');

        return row => ({
            ID: ID(row),
            Date: parseDate(Date(row)),
            Name: Name(row),
            Status: Status(row),
            Note: Note(row),
            Net: parseFloat(Net(row))
        });
    }

    function mkTrn(r) /*: STMTTRN*/ {
        return {
            TRNTYPE: 'CREDIT', // hmm...
            DTPOSTED: OFX.fmtDate(r.Date),
            TRNAMT: r.Net,
            FITID: r.ID,
            NAME: r.Name,
            MEMO: r.Note
        };
    }

    return Q.nfcall(csvp, data)
        .then(rows => {
            const hd = rows[0].map(n => n.trim());
            const records = rows.slice(1).map(record(hd))
                  .filter(r => r.Status == 'Completed');
            return records.map(mkTrn);
        });
}

function parseDate(mm_dd_yyyy) {
    const parts = /(\d+)\/(\d+)\/(\d+)/.exec(mm_dd_yyyy);
    const mdy = parts.slice(1, 4).map(s => parseInt(s));
    return new Date(mdy[2], mdy[0] - 1, mdy[1]);
}


// ugh:
// Cannot download a file #151
// https://github.com/segmentio/nightmare/issues/151
const requestDownload = function () {
    /*eslint-env browser */
    /*eslint-disable no-var*/

    // Down-cast from HTMLElement to HTMLFormElement via any
    var e /*: any*/ = document.querySelector('form[name="form1"]');
    var form /*: HTMLFormElement */ = e;

    // boo: FormData() turns into multipart,
    // but paypal expects urlencoded
    var buf = [];
    for (var i = 0; i < form.length; i++) {
        var item = ((form[i] /*: any*/)/*: HTMLInputElement */);
        var ty = item.hasAttribute('type') ?
            item.getAttribute('type') : null;
        if ((ty === 'radio' || ty === 'checkbox') && ! item.checked) {
            continue;
        }

        buf.push(encodeURIComponent(item.name) +
                 '=' +
                 encodeURIComponent(item.value));
    }

    var xhr = new XMLHttpRequest();
    var synchronous = false;
    xhr.open('POST', form.getAttribute('action') || '', synchronous);
    xhr.overrideMimeType('text/plain');
    xhr.send(buf.join('&'));
    return {
        status: xhr.status,
        statusText: xhr.statusText,
        responseType: xhr.responseType,
        responseText: xhr.responseText
    };

    /*eslint-enable no-var*/
    /*eslint-env node */
};

if (require.main == module) {
    const fs = require('fs');

    main(
        process.argv,
        { clock: () => new Date() },
        { spawn: require('child_process').spawn },
        { writeFile: fs.writeFile,
          createReadStream: fs.createReadStream,
          createWriteStream: fs.createWriteStream },
        { browser: require('nightmare') });
}

exports.driver = driver;
