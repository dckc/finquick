/**
@flow
*/

'use strict';
const Q    = require('q');
const docopt = require('docopt').docopt;
const parseOFX = require('banking').parse;

const freedesktop = require('./secret-tool');

const REALM = 'https://www.bankbv.com/';
const usage = `
Usage:
  bbv.js history --login=ID --code=N --output=FILE [-r URL] [-q]
  bbv.js -h | --help

Options:
 -l ID --login=ID       BlueWave Login ID (account number)
 -c N --code=N          Account code for challenge questions (see below)
 -r URL --realm=URL     Realm of Chrome password entry in freedesktop
                        secret store (aka gnome keychain)
                        [default: ${REALM}]
 -o FILE --output=FILE  where to save OFX data
 -q                     quiet: do not show browser window
 -h --help              show usage

We look up the login password using the 'signon_realm' attribute,
following Chrome conventions.

For challenge questions, we use 'code' and 'question' as in:

$ ssh-askpass | secret-tool store --label 'Challenge Question' \\
    url https://www.bankbv.com/ code 1020 \\
    question "What is your mother's maiden name?"
`;

function main(argv, time, proc, fs, net) {
    'use strict';
    const cli = docopt(usage, { argv: argv.slice(2) });

    const keyChain = freedesktop.makeSecretTool(proc.spawn);
    const creds = {
        login: () => Q(cli['--login']),
        password: () => keyChain.lookup({signon_realm: cli['--realm']}),
        challenge: (question) => keyChain.lookup(
            {code: cli['--code'], question: question})
    };

    const d = driver();
    const ua = net.browser({ show: !cli['-q'] });
    const now = time.clock();

    d.download(ua, creds, daysBefore(14, now).valueOf(), now)
        .then(ofx => Q.nfcall(fs.writeFile, cli['--output'], ofx))
        .then(() => ua.end())
        .done();
}

const msPerDay = 24 * 60 * 60 * 1000;
function daysBefore(n, d) {
    return new Date(d.getTime() - n * msPerDay);
}

/*::
// TODO: factor out and share Driver type
type Driver = {
  realm(): string;
  download(ua: Nightmare, creds: Creds,
           start: number, now: Date): Promise<string>;
  toOFX(data: string): Promise<Array<STMTTRN>>
}

// TODO: move this to lib file so it can be shared
type STMTTRN = {
    TRNTYPE: Array<'CREDIT' | 'DEBIT'>;
    DTPOSTED: Array<DateString>;
    DTUSER?: Array<DateString>;
    TRNAMT: Array<number>;
    FITID: Array<string>;
    CHECKNUM?: Array<string>,
    NAME: Array<string>
}
type DateString = string;

type Creds = {
  login(): Promise<string>;
  password(): Promise<string>;
  challenge(question?: string): Promise<string>;
}

type Nightmare = any; // TODO
*/

exports.driver = driver;
function driver() /*: Driver */ {
    const login = Q.async(function*(userAgent, creds /*: Creds*/){
        console.log('login()...');
        const acctNum = yield creds.login();

        yield userAgent
            .goto('https://www.bankbv.com/')
            .wait(0.5 * 1000)
            .wait('.online-banking form')
            .insert('.online-banking input[name="username"]',
                    acctNum)
            .insert('.online-banking input[name="password"]',
                    yield creds.password())
            .click('.online-banking input[type="submit"]')
            .wait(5 * 1000) // wait for page load
            .wait('body');

        if (yield userAgent.exists('body#PassmarkChallenge')) {
            // console.log('Got challenge page');

            const q = yield userAgent.evaluate(
                textContentOf,
                '.input_table tr:nth-child(2) .input_data');
            const a = yield creds.challenge(q);

            yield userAgent.insert('input[name="login_form:answer"]', a)
                .click('.submission input[type="submit"]')
                .wait(3 * 1000)
                .wait('body');
        }

        const table0 = yield userAgent.evaluate(accountTable);

        const getHistory = Q.async(function*(_start, _now) {
            console.log('getHistory() TODO:', _start, _now);

            const navExportHistory = 'div#bottom_nav ul li:nth-child(3) a';
            const ofxFormat = 'tr:nth-child(4) ul li:nth-child(2) label';
            const response = yield userAgent
                .click(navExportHistory)
                .wait(2 * 1000)
                // pick account?
                // .insert('input[name="export_history:startDate"]', startDate)
                // .insert('input[name="export_history:endDate"]', endDate)
                .wait('form#export_history_form ' + ofxFormat)
                .click('form#export_history_form ' + ofxFormat)
                .wait(0.5 * 1000)
                .click('form#export_history_form input[type="submit"]')
                .wait(3 * 1000)
                .wait('div#main')
                .evaluate(requestDownload, 'export_history_instructions');
            if (!response) {
                throw 'no response from requestDownlaod!';
            }
            console.log(response.status, response.statusText);
            if (response.status === 200) {
                return response.responseText;
            } else {
                throw new Error(response.statusText);
            }
        });

        return Object.freeze({
            getHistory: getHistory,
            acctInfo: () => {
                if (table0 != null) {
                    const last4 = acctNum.substr(3, 4);
                    return table0.filter(
                        b => b.account.substr(3, 4) == last4);
                } else {
                    return [];
                }
            }
        });
    });

    function stmttrn(res) {
        const trnrs = res.body.OFX.BANKMSGSRSV1[0].STMTTRNRS[0];
        const status = trnrs.STATUS[0];
        if (status.CODE[0] != '0') {
            console.log('bank error:', status);
            throw new Error(status);
        }
        return trnrs.STMTRS[0]
            .BANKTRANLIST[0].STMTTRN.map(prettyTrx);
    }

    /** clean up transaction descriptions before import */
    function prettyTrx(trx) {
        if (trx.NAME[0].match(/^\d+ BLUEWAVE /)) {
            const parts = trx.MEMO[0].match(
                    /(\d+) (BLUEWAVE .* (FROM|TO) (\d+))/);
            trx.NAME[0] = parts[2];
            trx.CHECKNUM = [parts[1]];
        }
        if (trx.NAME[0].match(/^POS /)) {
            trx.NAME[0] = trx.MEMO[0].replace(
                    /POS TARGET DEBIT CRD ACH TRAN (TARGET .*)/, '$1');
        }
        if (trx.NAME[0].match(/^XX\S* POS \w+/)) {
            trx.NAME[0] = trx.MEMO[0].replace(
                    /XX\S* POS \w+\.? (AT )?..... ..... (.*)/, '$2');
        }
        if (trx.NAME[0].match(/^XX\S* ATM WITHDRAWAL/)) {
            trx.NAME[0] = trx.MEMO[0].replace(
                    /XX\S* ATM WITHDRAWAL. ..... ..... (.*)/, '$1');
        }
        
        return trx;
    }
    
    function toOFX(markup) {
        return Q.promise(resolve => parseOFX(markup, resolve))
            .then(stmttrn);
    }

    return Object.freeze({
        download: (ua, creds, start, now) => login(ua, creds)
            .then(session => session.getHistory(start, now)),
        realm: () => REALM,
        toOFX: toOFX
    });
}


// arrow functions don't seem to work inside Nightmare.evaluate()
/*eslint-env browser */
/*eslint-disable no-var*/
const textContentOf = function (selector) {
    return document.querySelector(selector).textContent;
};


/*::
type AcctInfo = {
  account: string,
  name: string,
  balance: number
}
*/
const accountTable = function() {
    var rows = document.querySelector(
        '.account_group #DataTables_Table_0 tbody').children;
    var data /*: Array<AcctInfo> */ = [];
    function col(row, ix) {
        return row.querySelector('td:nth-child(' + ix +')').textContent.trim();
    }
    for (var rowIx = 0; rowIx < rows.length; rowIx++) {
        var row = rows[rowIx];
        data.push({account: col(row, 2),
                   name: col(row, 3),
                   balance: parseFloat(col(row, 4)
                                       .replace('$', '')
                                       .replace(',', ''))});
    }
    return data;
};


// ack: azurelogic commented on Feb 17, 2015
// Cannot download a file #151
// https://github.com/segmentio/nightmare/issues/151#issuecomment-74787987
const requestDownload = function (name) {
    var formId = name + '_form';

    // down-cast from HTMLElement to HTMLFormElement
    var e /*: any*/ = document.forms[formId];
    var form /*: HTMLFormElement*/ = e;

    form[formId + ':_idcl'].value = name + ':submit_button';
    var fd = new FormData(form);
    var xhr = new XMLHttpRequest();
    var synchronous = false;
    xhr.open('POST', form.getAttribute('action'), synchronous);
    xhr.overrideMimeType('text/ofx');
    xhr.send(fd);
    return {
        status: xhr.status,
        statusText: xhr.statusText,
        responseText: xhr.responseText
    };
};
/*eslint-enable no-var*/
/*eslint-env node */


if (require.main == module) {
    main(
        process.argv,
        { clock: () => new Date() },
        { spawn: require('child_process').spawn },
        { writeFile: require('fs').writeFile },
        { browser: require('nightmare') });
}

// Local Variables:
// flycheck-checker: javascript-eslint
// End:
