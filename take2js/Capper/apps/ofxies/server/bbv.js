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
        .then(() => console.log('logged in!'))
        .done();
}

function daysBefore(n, d) {
    var msPerDay = 24 * 60 * 60 * 1000;
    return new Date(d.getTime() - n * msPerDay);
}

/*::
type HistoryRd = {
  login: () => Promise<null>;
  end: () => Promise<null>;
}

type Creds = {
  username: () => Promise<string>;
  password: () => Promise<string>;
  challenge: (question: string) => Promise<string>;
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
            .wait(1 * 1000) // wait for page load
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

        return yield userAgent
            .wait('#PassmarkLogin')
            .type('#login_form input[name="login_form:password"]',
                  yield creds.password())
            .click('#login_form input[type="submit"]')
            .wait(3 * 1000)
            .wait('div#welcome');
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
