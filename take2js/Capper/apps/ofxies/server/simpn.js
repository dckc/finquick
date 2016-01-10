var Q    = require('q');

function integrationTestMain(env, Nightmare) {
    'use strict';

    const creds = {
	username: process.env.SIMPLE_USERNAME,
	password: process.env.SIMPLE_PASSWORD
    };

    Q.spawn(() => doit(Nightmare, creds));
}


function* doit(Nightmare, creds) {
    'use strict';

    const n = Nightmare({
	show: true
    });

    const tx = yield n
	.goto('https://www.simple.com/signin')
	.wait(0.5 * 1000)
	.wait('input#login_username')
	.type('input#login_username', creds.username)
	.type('input#login_password', creds.password)
	.click('input#signin-btn')
	.wait(0.5 * 1000)
	.wait('#safe-to-spend')
        .evaluate(() => Butcher.models.Transactions);

    console.log('Transactions: ', tx);

    yield n.end();
}


if (process.env.TESTING) {
    integrationTestMain(
	{
	    username: process.env.SIMPLE_USERNAME,
	    password: process.env.SIMPLE_PASSWORD
	},
	require('nightmare'));
}
