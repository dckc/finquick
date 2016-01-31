/**
@flow
*/

'use strict';
const Q    = require('q');
const docopt = require('docopt').docopt;

const freedesktop = require('./secret-tool');

const usage = `
Usage:
  bbv.js history --login=ID --code=N --output=FILE [-r URL]
  bbv.js -h | --help

Options:
 -l ID --login=ID       BlueWave Login ID (account number)
 -c N --code=N          Account code for challenge questions (see below)
 -r URL --realm=URL     Realm of Chrome password entry in freedesktop
                        secret store (aka gnome keychain)
                        [default: https://pib.secure-banking.com/]
 -o FILE --output=FILE  where to save OFX data
 -h --help              show usage

We look up the login password using the 'signon_realm' attribute,
following Chrome conventions.

For challenge questions, we use 'code' and 'question' as in:

$ ssh-askpass | secret-tool store --label 'Challenge Question' \\
    url https://www.bankbv.com/ code 1020 \\
    question "What is your mother's maiden name?"
`;

function main(argv, access) {
    'use strict';
    const cli = docopt(usage, { argv: argv.slice(2) });

    const keyChain = freedesktop.makeSecretTool(access.spawn);
    const creds = {
        username: () => Q(cli['--login']),
        password: () => keyChain.lookup({signon_realm: cli['--realm']}),
        challenge: (question) => keyChain.lookup(
            {code: cli['--code'], question: question})
    };

    const acctHistoryRd = makeHistoryRd(
        access.nightmare({
            show: true  // DEBUG
        }),
        creds);
    acctHistoryRd.login()
        .then(session => session.getHistory())
        .then(ofx => Q.nfcall(access.writeFile, cli['--output'], ofx))
        .then(() => acctHistoryRd.end())
        .done();
}

function daysBefore(n, d) {
    var msPerDay = 24 * 60 * 60 * 1000;
    return new Date(d.getTime() - n * msPerDay);
}

/*::
type HistoryRd = {
  login(): Promise<Session>;
  end(): Promise<null>;
}

type Session = {
  getHistory(): Promise<string>
}

type Creds = {
  username(): Promise<string>;
  password(): Promise<string>;
  challenge(question?: string): Promise<string>;
}

*/

function makeHistoryRd(userAgent, creds /*: Creds*/) /*: HistoryRd */ {
    const login = Q.async(function*(){
        console.log('login()...');

        yield userAgent
            .goto('https://www.bankbv.com/')
            .wait(0.5 * 1000)
            .wait('.online-banking form')
            .type('.online-banking input[name="username"]',
                  yield creds.username())
            .type('.online-banking input[name="password"]',
                  yield creds.password())
            .click('.online-banking input[type="submit"]')
            .wait(5 * 1000) // wait for page load
            .wait('body');

        if (yield userAgent.exists('body#PassmarkChallenge')) {
            // console.log('Got challenge page');

            const q = yield userAgent.evaluate(
                // arrow functions don't seem to work across this boundary.
                function (selector) {
                    return document.querySelector(selector).textContent;
                },
                '.input_table tr:nth-child(2) .input_data');
            const a = yield creds.challenge(q);

            yield userAgent.type('input[name="login_form:answer"]', a)
                .click('.submission input[type="submit"]')
                .wait(0.5 * 1000)
                .wait('body');
        }

        const getHistory = Q.async(function*() {
            console.log('getHistory()...');

            const navExportHistory = 'div#bottom_nav ul li:nth-child(3) a';
            const ofxFormat = 'tr:nth-child(4) ul li:nth-child(2) label';
            const response = yield userAgent
                .click(navExportHistory)
                .wait(2 * 1000)
                // pick account?
                // .type('input[name="export_history:startDate"]', startDate)
                // .type('input[name="export_history:endDate"]', endDate)
                .wait('form#export_history_form ' + ofxFormat)
                .click('form#export_history_form ' + ofxFormat)
                .wait(0.5 * 1000)
                .click('form#export_history_form input[type="submit"]')
                .wait(3 * 1000)
                .wait('div#main')
                .evaluate(
// ack: azurelogic commented on Feb 17, 2015
// Cannot download a file #151
// https://github.com/segmentio/nightmare/issues/151#issuecomment-74787987
                function (name) {
                    var formId = name + '_form';
                    var form = document.querySelector('form#' + formId);
                    document.forms[formId][formId + ':_idcl'].value = name + ':submit_button';
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
                }, 'export_history_instructions');
            console.log(response.status, response.statusText);
            if (response.status === 200) {
                return response.responseText;
            } else {
                throw new Error(response.statusText);
            }
        });

        return Object.freeze({
            getHistory: getHistory
        });
    });

    return Object.freeze({
        login: login,
        end: Q.async(function*() {
            yield userAgent.end();
        })
    });
}


if (require.main === module) {
    main(
        process.argv,
        { clock: () => new Date(),
          spawn: require('child_process').spawn,
          writeFile: require('fs').writeFile,
          nightmare: require('nightmare')
        });
}

exports.makeHistoryRd = makeHistoryRd;
