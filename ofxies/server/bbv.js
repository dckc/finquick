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

    d.download(ua, creds, daysBefore(14, now).valueOf(), now)
        .then(h => Q.all([
            Q.nfcall(fs.writeFile, cli['--ofx'], h.ofx),
            Q.nfcall(fs.writeFile, cli['--txfrs'], JSON.stringify(h.txfrs))
        ]))
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
           start: number, now: Date): Promise<History>;
  toOFX(data: History): Promise<Array<STMTTRN>>
}

type History = {
  ofx: string,
  txfrs: Array<Txfr>,
  accounts: Array<AcctInfo>
}

type Txfr = {
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
            const txfrs = yield getTransfers();
            return { ofx: ofx, txfrs: txfrs, accounts: table0 };
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

    function toOFX(history) {
        return Q.promise(resolve => parseOFX(history.ofx, resolve))
            .then(stmttrn);
    }

    return Object.freeze({
        download: (ua, creds, start, now) => login(ua, creds)
            .then(session => session.getHistory(start, now)),
        realm: () => REALM,
        toOFX: toOFX
    });
}


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

function combine(ofxAcct, ofx, json) {
    const txfrs = JSON.parse(json);
    const from_mdy = mdy => {
        const parts = mdy.match('([0-9]+)/([0-9]+)/([0-9]+)');
        return new Date(parseInt(parts[3]),
                        parseInt(parts[1]) - 1,
                        parseInt(parts[2]));
    };
    const by_date_amt = (ta, tb) => (
        Math.abs(ta.amount) < Math.abs(tb.amount) ? -1 :
            Math.abs(ta.amount) > Math.abs(tb.amount) ? 1 :
            ta.date.valueOf() - tb.date.valueOf()
    );
    return Q.promise(resolve => parseOFX(ofx, resolve))
        .then(stmttrn)
        .then(trns => {
            const last4 = num => (num || '').substr(3, 4);
            const field = (t, n) => t.fields
                  .filter(f => f.label == n)
                  .map(f => (f.title || f.value).replace(/^./, '')).join('');
            const scraped = txfrs
                  .map(t => ({
                      date: from_mdy(t.date)
                          .toISOString().substr(0, 'yyyy-mm-dd'.length),
                      amount: parseFloat(t.amount.replace(/[$,]/g, '')),
                      from4: last4(field(t, 'From Account:')),
                      to4: last4(t.to),
                      to: (t.to || '').replace(/^xxx.... - /, ''),
                      from: field(t, 'From Account:').replace(/^xxx.... - /, ''),
                      id: t.id.replace(/^tran_/, ''),
                      memo: field(t, 'Memo:').replace(/ TRANSFER.*/, '')
                  }));
            const acctName = new Map(scraped.reduce(
                (acc, t) => [].concat(acc,
                                      t.to ? [[t.to4, t.to]] : [],
                                      t.from ? [[t.from4, t.from]] : []),
                []));

            const ofx = trns
                  .map(prettyTrx)
                  .map(t => Object.assign(
                      t, { txfr: t['NAME'][0].match(/BLUEWAVE (LOAN PAYMENT|TRANSFER) (FROM|TO) ([0-9]+)/) }))
                  .filter(t => t.txfr)
                  .map(t => {
                      const any = f => t[f] ? t[f][0] : '';
                      const the = f => t[f][0];
                      const amount = parseFloat(the('TRNAMT'));
                      const sign = t.txfr[2] == 'FROM' ? 1 : -1;
                      const other = t.txfr[3];
                      const accts = (sign > 0 ?
                                     { from: other, to: ofxAcct } :
                                     { from: ofxAcct, to: other });
                      const posted = OFX.parseDate(the('DTPOSTED'));
                      const fmtDate = d => d.toISOString().substr(0, 10);
                      const scrapedMemo = scraped.filter(
                          st => st.amount == Math.abs(amount) &&
                              st.date <= fmtDate(posted) &&
                              st.date >= fmtDate(
                                  new Date(posted.valueOf() - 3 * msPerDay)) &&
                              st.from4 == last4(accts.from) &&
                              st.to4 == last4(accts.to))
                            .map(st => st.memo).join(' / ')
                            .replace(/^TRANSFER .*/, '');

                      return {
                          date: fmtDate(posted),
                          time: posted.toLocaleTimeString(),
                          amount: amount,
                          trntype: the('TRNTYPE'),
                          id: the('FITID'),
                          description: (
                              the('NAME') + ' ' +
                                  (acctName.get(last4(other)) || '')).trim(),
                          from4: last4(accts.from),
                          to4: last4(accts.to),
                          memo0: any('MEMO'),
                          memo: scrapedMemo
                      };
                  });
            return {
                cols: ['id', 'date', 'time',
                       'trntype', 'amount', 'from4', 'to4', 'to',
                       'description', 'memo', 'memo0'],
                // records: [].concat(ofx, scraped).sort(by_date_amt).reverse()
                records: ofx.sort(by_date_amt).reverse()
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

const txfrFields = function (summary, snapshot) {
    var tran = $(summary);
    var tran_details = $(snapshot).find('div.tran_details');
    return {
        date: tran.find('td:nth-child(3)').text(),
        from: tran.find('td:nth-child(4) span').attr('title'),
        to: tran.find('td:nth-child(5) span').attr('title'),
        amount: tran.find('td:nth-child(6)').text(),
        ref: $(snapshot).find('h4').text(),
        id: tran_details.attr('id'),
        fields: $.map(tran_details.find('.field'), function(div) {
            return { label: $(div).find('.label').text(),
                     value: $(div).find('.value').text(),
                     title: $(div).find('.value span').attr('title')
                   };
        })
    };
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
        { spawn: require('child_process').spawn,
          stdout: process.stdout },
        { writeFile: require('fs').writeFile,
          readFile: require('fs').readFile },
        { browser: require('nightmare') });
}

// Local Variables:
// flycheck-checker: javascript-eslint
// End:
