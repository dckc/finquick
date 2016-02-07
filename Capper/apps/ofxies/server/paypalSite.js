/**
@flow
*/

'use strict';
const Q    = require('q');
const docopt = require('docopt').docopt;

const freedesktop = require('./secret-tool');

const usage = `
Usage:
  paypalSite.js activity --login=EMAIL --output=FILE [-r URL]
  paypalSite.js -h | --help

Options:
 -l M --login=EMAIL     Login email
 -r URL --realm=URL     Realm of Chrome password entry in freedesktop
                        secret store (aka gnome keychain)
                        [default: https://www.paypal.com/]
 -o FILE --output=FILE  where to save CSV data
 -h --help              show usage

We look up the login password using the 'signon_realm' attribute,
following Chrome conventions.

`;

function main(argv /*:Array<string>*/, access) {
    'use strict';
    const cli = docopt(usage, { argv: argv.slice(2) });

    const keyChain = freedesktop.makeSecretTool(access.spawn);
    const creds = {
        login: () => Q(cli['--login']),
        password: () => keyChain.lookup({signon_realm: cli['--realm']})
    };

    const debug = true;
    const nightmare = access.nightmare({ show: debug, waitTimeout: 20 * 1000 });
    const activityExport = makeActivityExport(nightmare, creds);
    activityExport.login()
        .then(session => session.downloadActivity())
        .then(csv => Q.nfcall(access.writeFile, cli['--output'], csv))
        .then(() => nightmare.end())
        .done();
}

/*::
type Site = {
  login(): Promise<Session>;
}

type Session = {
  downloadActivity(): Promise<string>
}

type Creds = {
  login(): Promise<string>;
  password(): Promise<string>;
}

type Nightmare = any; // TODO
*/

function makeActivityExport(userAgent /*: Nightmare*/,
                            creds /*: Creds*/) /*: Site */ {
    const login = Q.async(function*(){
        console.log('login()...');

        yield userAgent
            .goto('https://www.paypal.com/signin/')
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


        const downloadActivity = Q.async(function*(startDate, endDate) {
            console.log('downloadActivity() TODO:', startDate, endDate);

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
        login: login
    });
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
        { clock: () => new Date(),
          spawn: require('child_process').spawn,
          writeFile: require('fs').writeFile,
          nightmare: require('nightmare')
        });
}

exports.makeActivityExport = makeActivityExport;
