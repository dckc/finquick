var Q    = require('q');

function integrationTestMain(stdout, env, Nightmare) {
    'use strict';

    const credsP = Q({
        username: env.SIMPLE_USERNAME,
        password: env.SIMPLE_PASSWORD
    });

    const acctRd = makeSimpleRd(Nightmare, credsP);
    acctRd.transactions()
        .then((txns) => stdout.write(JSON.stringify(txns)))
        .then(() => acctRd.end())
        .done();
}


function makeSimpleRd(Nightmare, credsP) {
    'use strict';
    const userAgent = Nightmare({
        show: true  // DEBUG
    });

    const transactions = Q.async(function *(){
        yield login();

        // note document below refers to the user agent's document
        return yield userAgent
            .evaluate(() => window.Butcher.models.Transactions);
    });

    let visited = false;

    const login = Q.async(function*(){
        const nameSel = '.masthead-username';
        const getName =
            () => document.querySelector('.masthead-username').innerText;

        const viz = visited &&
            (yield userAgent.exists(nameSel)) &&
            (yield userAgent.visible(nameSel));

        if (! viz) {
            const creds = yield credsP;

            yield userAgent
                .goto('https://www.simple.com/signin')
                .wait(0.5 * 1000)
                .wait('input#login_username')
                .type('input#login_username', creds.username)
                .type('input#login_password', creds.password)
                .click('input#signin-btn')
                .wait(0.5 * 1000)
                .wait(nameSel);
            visited = true;
        }
        const name = yield userAgent.evaluate(getName);
        return name;
    });

    return Object.freeze({
        transactions: transactions,
        login: login,
        end: () => userAgent.end()
    });
}


if (process.env.TESTING) {
    integrationTestMain(
        process.stdout,
        process.env,
        require('nightmare'));
}

exports.makeSimpleRd = makeSimpleRd;
