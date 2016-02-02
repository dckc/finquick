'use strict';
var Q    = require('q');

function main(stdout, env, Nightmare) {

    const creds = {
        username: () => Q(env.SIMPLE_USERNAME),
        password: () => Q(env.SIMPLE_PASSWORD)
    };

    const debug = true;
    const userAgent = Nightmare({ show: debug });
    const acctRd = makeSimpleRd(userAgent, creds);
    acctRd.transactions()
        .then((txns) => stdout.write(JSON.stringify(txns)))
        .then(() => userAgent.end())
        .done();
}


function makeSimpleRd(userAgent, creds) {
    const transactions = Q.async(function *(){
        yield login();

        // note document below refers to the user agent's document
        console.log('fetching simple.com transactions');
        return yield userAgent
            .evaluate(() => window.Butcher.models.Transactions);
    });

    // Interrogating the page before we have visited it hangs.
    let visited = false;

    const login = Q.async(function*(){
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
                .goto('https://www.simple.com/signin')
                .wait(0.5 * 1000)
                .wait('input#login_username')
                .type('input#login_username', yield creds.username())
                .type('input#login_password', yield creds.password())
                .click('input#signin-btn')
                .wait(0.5 * 1000)
                .wait(nameSel);
            visited = true;
        }
        const name = yield userAgent.evaluate(getName);
        console.log('logged in as: ', name);
        return name;
    });

    return Object.freeze({
        transactions: transactions,
        login: login,
    });
}


if (require.main === module) {
    main(
        process.stdout,
        process.env,
        require('nightmare'));
}

exports.makeSimpleRd = makeSimpleRd;
