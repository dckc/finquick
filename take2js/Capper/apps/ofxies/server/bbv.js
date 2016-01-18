/**
@flow
*/

'use strict';
var Q    = require('q');
var freedesktop = require('./secret-tool');

function integrationTestMain(argv, stdout, access) {
    'use strict';
    const keyChain = freedesktop.makeSecretTool(access.spawn);
    const username = argv[2];
    const code = argv[3];
    const realm = argv[4];

    const creds = {
        username: () => Q(username),
        password: () => keyChain.lookup({signon_realm: realm}),
        challenge: (question) => keyChain.lookup(
            {code: code, question: question})
    };

    const acctHistoryRd = makeHistoryRd(
        access.nightmare({
            show: true  // DEBUG
        }),
        creds);
    acctHistoryRd.login()
        .then((session) => session.getHistory())
        .then((historyResponse) => console.log('history?', historyResponse))
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
  getHistory(): Promise<{ status: number, responseText: string}>
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

        yield userAgent
            .wait('#PassmarkLogin')
            .type('#login_form input[name="login_form:password"]',
                  yield creds.password())
            .click('#login_form input[type="submit"]')
            .wait(3 * 1000)
            .wait('div#welcome');

        function getHistory() {
            console.log('getHistory()...');

            const navExportHistory = 'div#bottom_nav ul li:nth-child(3) a';
            const ofxFormat = 'tr:nth-child(4) ul li:nth-child(2)';
            return userAgent
                .click(navExportHistory)
                .wait(3 * 1000)
                // pick account?
                // .type('input[name="export_history:startDate"]', startDate)
                // .type('input[name="export_history:endDate"]', endDate)
                // OFX format

                .click('form#export_history_form ' + ofxFormat)
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
                        responseText: xhr.responseText
                    };
                }, 'export_history_instructions');
        }

        return Object.freeze({
            getHistory: getHistory
        });
    });

    return Object.freeze({
        login: login,
        end: () => userAgent.end()
    });
}


if (process.env.TESTING) {
    integrationTestMain(
        process.argv,
        process.stdout,
        { clock: () => new Date(),
          spawn: require('child_process').spawn,
          nightmare: require('nightmare')
        });
}

exports.makeHistoryRd = makeHistoryRd;
