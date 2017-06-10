/**
@flow
*/

'use strict';
const Q    = require('q');
const docopt = require('docopt').docopt;
const parseOFX = require('banking').parse;
const OFX = require('./asOFX').OFX;

const freedesktop = require('./secret-tool');

const REALM = 'https://www.bankbv.com/';
const usage = `
Usage:
  bbv.js history --login=ID --code=N --ofx=FILE --txfrs=FILE [-r URL] [-q]
  bbv.js checks --login=ID --code=N --storage=DIR <num>...
  bbv.js combine --login=ID --ofx=FILE --txfrs=FILE
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

/*eslint-disable no-console*/

function main(argv, time, proc, fs, net) {
    'use strict';
    const cli = docopt(usage, { argv: argv.slice(2) });

    if (cli['combine']) {
        return Q.all([
            Q(cli['--login']),
            Q.nfcall(fs.readFile, cli['--ofx'], 'utf8'),
            Q.nfcall(fs.readFile, cli['--txfrs'], 'utf8')
        ]).spread(combine)
            .then(data => csv_export(proc.stdout, data.cols, data.records))
            .done();
    }

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

    if (cli['checks']) {
        return d.checkImages(ua, creds, cli['--storage'], cli['<num>'])
            .then(() => ua.end())
            .done();
    }

    if (cli['history']) {
        d.download(ua, creds, daysBefore(14, now).valueOf(), now)
            .then(h => Q.all([
                Q.nfcall(fs.writeFile, cli['--ofx'], h.ofx),
                Q.nfcall(fs.writeFile, cli['--txfrs'], JSON.stringify(h.txfrs))
            ]))
            .then(() => ua.end())
            .done();
    }
}

const msPerDay = 24 * 60 * 60 * 1000;
function daysBefore(n, d) {
    return new Date(d.getTime() - n * msPerDay);
}

/*::
import type {Driver, Creds} from './dldriver';
import type {STMTTRN} from './asOFX';

type History = {
  ofx: string,
  txfrs: Array<Txfr>,
  acctNum: string,
  accounts: Array<AcctInfo>
};

type Txfr = Object;

type Nightmare = any; // TODO
*/

exports.driver = driver;
function driver() /*: Driver */ {
    const login = Q.async(function*(userAgent, creds /*: Creds*/){
        console.log('login()...');
        const acctNum = yield creds.login();
        if(! acctNum) { throw('why does flow think this can fail?'); }

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

        const getHistory = Q.async(function*(start, now) {
            const ofx = yield getOFX(start, now);
            let txfrs = [];
            try {
                txfrs = yield getTransfers();
            } catch (oops) {
                console.warn('failed to get transfers:', oops);
            }
            return { ofx: ofx, txfrs: txfrs,
                     acctNum: acctNum, accounts: table0 };
        });
                                   
        const getOFX = Q.async(function*(_start, _now) {
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

        const getTransfers = Q.async(function*() {
            console.log('getTransfers()');

            const navTransfer = 'div#top_nav ul li:nth-child(2) a';
            const navActivity = 'div#bottom_nav ul li:nth-child(2) a';
            const txCount = yield userAgent
                  .click(navTransfer)
                  .wait(0.5 * 1000)
                  .wait('#transfers_form')
                  .click(navActivity)
                  .wait(0.5 * 1000)
                  .wait('h3#filter_header')
                  .select('#transactions_table_length select', '100')
                  .select('#search_dates', '60')
                  .click('#search_apply')
                  .wait(2 * 1000)
                  .evaluate(
                      childCount,
                      '#transactions_table tbody');
            console.log('txCount:', txCount);

            // Open all the transfers
            // last to first so that inserted rows don't interfere.
            const txfrDetail = [];
            for (let tr = (0 + txCount); tr > 0; tr--) {
                const sel = (tr, rest) => `#transactions_table tbody tr:nth-child(${tr})${rest}`;
                yield userAgent
                    .click(sel(tr, ' a img'))
                    .wait(0.2);

                const detail = yield userAgent
                      .wait(sel(tr + 1, ' td.snapshot'))
                      .evaluate(txfrFields,
                                sel(tr, ''),
                                sel(tr + 1, ' td.snapshot'));

                txfrDetail.push(detail);
            }

            return txfrDetail;
        });

        const checkImages = Q.async(function*(storage, nums) {
            const navViewChecks = 'div#bottom_nav ul li:nth-child(5) a';
            yield userAgent
                .click(navViewChecks)
                .wait(2 * 1000);
            for (let num of nums) {
                console.log(`${storage}/${num}.png`);
                yield userAgent
                    .insert('input[name="view_checks:checkNumber"]', num)
                    .wait()
                    .click('input.input_submit')
                    .wait()
                    .wait('img.check_image')
                    .screenshot(`${storage}/${num}.png`)
                    .click('input.input_submit')  // Back
                    .wait();
            }
        });

        return Object.freeze({
            getHistory: getHistory,
            checkImages: checkImages,
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

    function toOFX(history) {
        const scraped = transferActivity(history.acctNum, history.txfrs);
        return Q.promise(resolve => parseOFX(history.ofx, resolve))
            .then(stmttrn)
            .then(trxs => trxs
                  .map(prettyTrx)
                  .map(scraped.with_matching_memo));
    }

    return Object.freeze({
        download: (ua, creds, start, now) => login(ua, creds)
            .then(session => session.getHistory(start, now)),
        checkImages: (ua, creds, storage, nums) => login(ua, creds)
            .then(session => session.checkImages(storage, nums)),
        realm: () => REALM,
        toOFX: toOFX
    });
}


function stmttrn(res) /*: Array<STMTTRN> */ {
    const trnrs = res.body.OFX.BANKMSGSRSV1.STMTTRNRS;
    const status = trnrs.STATUS;
    if (status.CODE != '0') {
        console.log('bank error:', status);
        throw new Error(status);
    }
    return trnrs.STMTRS
        .BANKTRANLIST.STMTTRN;
}

    /** clean up transaction descriptions before import */
function prettyTrx(trx /*: STMTTRN*/) {
    if (trx.NAME.match(/^\d+ BLUEWAVE /)) {
        const parts = (trx.MEMO || '').match(
                /(\d+) (BLUEWAVE .* (FROM|TO) (\d+))/);
        if (parts) {
            trx.NAME = parts[2];
            trx.CHECKNUM = parts[1];
        }
    }
    if (trx.NAME.match(/^POS /)) {
        trx.NAME = (trx.MEMO || '').replace(
                /POS TARGET DEBIT CRD ACH TRAN (TARGET .*)/, '$1');
    }
    if (trx.NAME.match(/^XX\S* POS \w+/)) {
        trx.NAME = (trx.MEMO || '').replace(
                /XX\S* POS \w+\.? (AT )?..... ..... (.*)/, '$2');
    }
    if (trx.NAME.match(/^XX\S* ATM WITHDRAWAL/)) {
        trx.NAME = (trx.MEMO || '').replace(
                /XX\S* ATM WITHDRAWAL. ..... ..... (.*)/, '$1');
    }
    
    return trx;
}


function transferActivity(ofxAcct, scraped) {
    const from_mdy = mdy => {
        const parts = mdy.match('([0-9]+)/([0-9]+)/([0-9]+)');
        return new Date(parseInt(parts[3]),
                        parseInt(parts[1]) - 1,
                        parseInt(parts[2]));
    };
    const fmt_date = dt => dt.toISOString().substr(0, 'yyyy-mm-dd'.length);
    const from_dollars = txt => parseFloat(txt.replace(/[$,]/g, ''));
    const last4 = (num /*: string */) => (num || '').trim().substr(3, 4);
    const parse_acct = txt => ({
        num4: last4(txt),
        name: (txt || '').trim().replace(/^xxx.... - /, '')
    });
    const novel = txt => txt.replace(/TRANSFER.*/, '');
    const scrapedData = scraped
          .map(t => ({
              tran: t.details.id.replace(/^tran_/, ''),
              date: fmt_date(from_mdy(t['Send Date'].text)),
              amount: from_dollars(t['Amount'].text),
              from: parse_acct(t.details['From Account:'].value),
              to: parse_acct(t.details['To Account:'].value),
              memo: novel((t.details['Memo:'].title ||
                           t.details['Memo:'].value).trim())
          }));

    const byNum4 = new Map(scrapedData.reduce(
        (acc, t) => [].concat(
            acc,
            t.to ? [[t.to.num4, t.to.name]] : [],
            t.from ? [[t.from.num4, t.from.name]] : []),
        []));

    const matches = (t, from_to, other) => {
        const the = f => t[f];
        const accts = (from_to == 'FROM' ?
                       { from: other, to: ofxAcct } :
                       { from: ofxAcct, to: other });
        const posted = OFX.parseDate(the('DTPOSTED'));

        return scrapedData.filter(
            st => st.amount == Math.abs(parseFloat(the('TRNAMT'))) &&
                st.date <= fmt_date(posted) &&
                st.date >= fmt_date(daysBefore(3, posted)) &&
                st.from.num4 == last4(accts.from) &&
                st.to.num4 == last4(accts.to));
    };

    const with_matching_memo = t => {
        const txfr = t['NAME']
              .match(/BLUEWAVE (LOAN PAYMENT|TRANSFER) (FROM|TO) ([0-9]+)/);
        if (txfr) {
            const name = byNum4.get(last4(txfr[3]));
            if (name) {
                t['NAME'] = t['NAME'] + ' ' + name; 
            }
            t['MEMO'] = matches(t, txfr[2], txfr[3])
                .map(st => st.memo).join(' / ');
        }
        return t;
    };

    return Object.freeze({
        with_matching_memo: with_matching_memo
    });
}


function combine(ofxAcct, ofx, json) {
    const scraped = transferActivity(ofxAcct, JSON.parse(json));
    return Q.promise(resolve => parseOFX(ofx, resolve))
        .then(stmttrn)
        .then(trns => trns
              .map(prettyTrx)
              .map(scraped.with_matching_memo))
        .then(trns => {
            const records = trns.map(
                t => ({
                    fitid: t.FITID,
                    posted: t.DTPOSTED,
                    trntype: t.TRNTYPE,
                    trnamt: t.TRNAMT,
                    name: t.NAME,
                    memo: (t.MEMO || [''])
                }));
            return {
                cols: ['fitid', 'posted',
                       'trntype', 'trnamt',
                       'name', 'memo'],
                records: records
            };
        });
}


function csv_export(out, cols, records) {
    // header
    cols.forEach((name, ix) => {
        if (ix > 0) { out.write(','); }
        out.write(`${name}`);
    });
    out.write('\n');
    const quot = s => '"' + s.replace(/"/g, '""') + '"';
    records.forEach((r, _ix) => {
        cols.forEach((name, ix) => {
            if (ix > 0) { out.write(','); }
            out.write(quot(`${r[name] || ''}`));
        });
        out.write('\n');
    });
}

// arrow functions don't seem to work inside Nightmare.evaluate()
/*eslint-env browser */
/*eslint-disable no-var*/
const textContentOf = function (selector) {
    return document.querySelector(selector).textContent;
};

const childCount = function (selector) {
    return document.querySelector(selector).children.length;
};

var $ /*: any*/ = 'dummy-for-flow';  // in-page jquery

const txfrFields = function (tr, td_snapshot) {
    var thead = [null, 'Type', 'Send Date', 'From', 'To', 'Amount'];
    // for each column, get the text and title
    var tran = {};
    $(tr).find('td').each((ix, td) => {
        var th = thead[ix];
        if (th) {
            tran[th] = { text: $(td).text(),
                         title: $(td).find('span').attr('title') };
        }
    });

    var tran_details = $(td_snapshot).find('div.tran_details');
    tran.details = {
        id: tran_details.attr('id'),
        h4: $(td_snapshot).find('h4').text()  // Reference number:
    };
    tran_details.find('.field').each((_ix, div) => {
        var label = $(div).find('.label').text(); // e.g. From Account:
        tran.details[label] = {
            value: $(div).find('.value').text(),
            title: $(div).find('.value span').attr('title')
        };
    });

    return tran;
};


/*::
type AcctInfo = {
  account: string,
  name: string,
  balance: number
}
*/
const accountTable = function() {
    var rows_ = document.querySelector(
        '.account_group #DataTables_Table_0 tbody');
    var rows = rows_ ? rows_.children : [];
    var data /*: Array<AcctInfo> */ = [];
    function col(row, ix) {
        var td = row.querySelector('td:nth-child(' + ix +')');
        return td ? td.textContent.trim() : '';
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
    xhr.open('POST', form.getAttribute('action') || '', synchronous);
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
        { spawn: require('child_process').spawn,
          stdout: process.stdout },
        { writeFile: require('fs').writeFile,
          readFile: require('fs').readFile },
        { browser: require('nightmare') });
}

// Local Variables:
// flycheck-checker: javascript-eslint
// End:
