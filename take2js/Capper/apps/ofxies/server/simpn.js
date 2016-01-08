var Nightmare = require('nightmare');
var Q    = require('q');

var creds = {
    username: process.env.SIMPLE_USERNAME,
    password: process.env.SIMPLE_PASSWORD
};

function* doit() {
    const n = Nightmare({show:true});
    const t = yield n
	.goto('https://www.simple.com/signin')
	.type('input#login_username', creds.username)
	.type('input#login_password', creds.password)
	.click('input#signin-btn')
	.wait('#export-btn')
	.title();

    console.log(t);

    yield n.end();
}

Q.spawn(doit);


