/**
@flow
*/

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

    const keyChain = freedesktop.makeSecretTool(proc.spawn);
    const creds = {
        login: () => Q(cli['--login']),
        password: () => keyChain.lookup({signon_realm: cli['--realm']})
    };
    const ua = net.browser(
        { show: !cli['-q'],
          waitTimeout: parseInt(cli['-w']) * 1000 });
    const save = data => Q.nfcall(fs.writeFile, cli['--output'], data);

    const d = driver();
    d.download(ua, creds, 0, time.clock())
        .then(save)
        .then(() => ua.end())
        .done();
}

/*::
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

type Transaction = {
  ID: string,
  Date: Date,
  Name: string,
  Status: string,
  Note: string,
  Net: number
};

type Creds = {
  login(): Promise<string>;
  password(): Promise<string>;
}

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


        const downloadActivity = Q.async(function*(_startDate, _endDate) {
            console.log('downloadActivity() TODO:', _startDate, _endDate);

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
                .click('form[name="form1"] input[value="custom_date_range"]')
                .select('form[name="form1"] select[name="custom_file_type"]',
                        'comma_balaffecting')
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


function toOFX(data) {
    /*:: type TxMaker = (row: Array<string>) => Transaction */
    function record(hd /*: Array<string>*/) /*: TxMaker*/{
        const field = name => (row => {
            const ix = hd.indexOf(name);
            if (ix < 0 || ix + 1 > row.length) {
                throw Error([name, ix, hd, row.length]);
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
            TRNTYPE: ['CREDIT'], // hmm...
            DTPOSTED: [OFX.fmtDate(r.Date)],
            TRNAMT: [r.Net],
            FITID: [r.ID],
            NAME: [r.Name],
            MEMO: [r.Note]
        };
    }

    return Q.nfcall(csvp, data)
        .then(rows => {
            const hd = rows[0].map(n => n.trim());
            const records = rows.slice(1).map(record(hd));
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
        // flow doesn't seem to know that forms can be indexed by number.
        var item = form[/*:: '' + */i];
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
    xhr.open('POST', form.getAttribute('action'), synchronous);
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

if (require.main === module) {
    main(
        process.argv,
        { clock: () => new Date() },
        { spawn: require('child_process').spawn },
        { writeFile: require('fs').writeFile },
        { browser: require('nightmare') });
}

exports.driver = driver;
