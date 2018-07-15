const Q = require('q');
const url = require('url');
const https_request = require('https').request;

function main(https, creds) {
    const svc = PayPalService(https.Agent());
    const session = svc.getToken(creds).then(tok => {
	console.log(tok);
    });
}

function PayPalService(agent) {
    const api = new url.URL('https://api.sandbox.paypal.com/v1/');

    // https://developer.paypal.com/docs/api/overview/#get-an-access-token
    function getToken({client_id, secret}) {
	const grant_type = 'client_credentials';

	const reqD = Q.defer();
	const t = new url.URL('oauth2/token', api);
	const options = {
	    agent: agent,
	    method: 'POST',
	    hostname: t.hostname,
	    path: t.pathname,
	    headers: {
		'Accept': 'application/json',
		'Content-Type': 'application/x-www-form-urlencoded'
	    },
	    auth: `${client_id}:${secret}`,
	};
	// console.log('options:', options);

	let body = '';
	const req = https_request(options, (res) => {
	    if (res.statusCode != 200) {
		reqD.reject({ badStatus: res.statusCode});
	    }
	    // console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
	    res.setEncoding('utf8');
	    res.on('data', (chunk) => {
		body += chunk;
	    });
	    res.on('end', () => {
		const bodyObj = JSON.parse(body);
		if (!bodyObj) {
		    reqD.reject({ badJSON: body });
		    return;
		}
		reqD.resolve(bodyObj);
	    });
	});

	req.write(`grant_type=${grant_type}`);
	req.on('error', (e) => {
	    reqD.reject({ requestError: e.message });
	});

	req.end();
	return reqD.promise;
    }

    return Object.freeze({ getToken });
}


if (require.main == module) {
    const https = require('https');
    const creds = {
	client_id: '...',
	secret: '...'
    };
    main(https, creds);
}
