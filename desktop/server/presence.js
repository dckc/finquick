/** presence -- subscribe to presence of desktop user
 *
 * for example, to allow access only while the user is present
 */
// @flow

'use strict';

const Q = require('q');
const dbus = require('dbus-native');  // native JS, not bindings to native code

function main(process, net) {
    const sessionBus = makeSessionBus(process.env, net.connectAbstract);

    const attrs = argPairs(process.argv.slice(2));
    console.log('searching with attrs:', attrs, process.argv);
    secretSpace(sessionBus, []).subSpace(attrs).lookup()
        .then(secret => console.log('TADA!', secret))
        .fail(oops => console.log('no cookie for you:', oops));

    const doorPrize = Q.defer();
    const winner = onlyWhenPresent(sessionBus, doorPrize.promise);
    const t = setTimeout(_ => doorPrize.resolve('you win!'), 3 * 1000);

    winner
        .then(prize => console.log(prize))
        .fail(oops => console.log('must be present to win', oops));
}

function argPairs(args) {
    const out = [];
    for (let ix = 0; ix < args.length; ix += 2) {
        out.push(args.slice(ix, ix + 2));
    }
    return out;
}

function onlyWhenPresent(bus, p) {
    let present = false;

    // ISSUE: Somthing in here seems to cause node.js to run forever.
    bus.getService('org.gnome.ScreenSaver').getInterface(
        '/org/gnome/ScreenSaver',
        'org.gnome.ScreenSaver', function(err, screensaver) {
            if(err) {
                console.log(err)
            }
            console.log('got interface: ', screensaver);
            screensaver.GetActive((err, screenBlanked) => {
                present = !screenBlanked;
                console.log('initially blanked?', screenBlanked, 'present?', present);
            });

            // dbus signals are EventEmitter events
            screensaver.on('ActiveChanged', function(screenBlanked) {
                present = !screenBlanked;
                console.log('ActiveChanged', screenBlanked, 'present?', present);
            });
        });

    return p.then(x => {
        console.log('upstream resolved; present?', present);
        if (present) {
            return x;
        } else {
            throw('desktop user not present');
        }
    });
}


/**

prototyping:

$ dbus-send --session --dest=org.freedesktop.secrets \
    --type=method_call --print-reply /org/freedesktop/secrets \
    org.freedesktop.DBus.Introspectable.Introspect


$ dbus-send --session --dest=org.freedesktop.secrets \
    --type=method_call --print-reply /org/freedesktop/secrets \
    org.freedesktop.Secret.Service.OpenSession \
    string:plain variant:string:x

method return time=1506198592.257631 sender=:1.3 -> destination=:1.731 serial=31473 reply_serial=2
   variant       string ""
   object path "/org/freedesktop/secrets/session/s50"
*/
    

function secretSpace(bus, attrs) {
    function itemsAndService() {
        const svcP = Q.ninvoke(bus.getService('org.freedesktop.secrets'), 'getInterface',
                               '/org/freedesktop/secrets', 'org.freedesktop.Secret.Service');
        return [svcP.then(svc => Q.ninvoke(svc, 'SearchItems', attrs)), svcP];
    }

    function friendly(key_parts) {
        // ISSUE: find out how properties work and get the label and such?

        // we use 'plain', so output is always ''
        let [key, [secretSession, _output, secret, mediaType]] = key_parts;
        return {
            item: key,
            secretSession: secretSession,
            secret: secret.toString(),
            mediaType: mediaType
        };
    }
    
    function lookup() {
        const [itemsP, svcP] = itemsAndService();
        const secretP = svcP.then(svc => {
            const emptyStringVariant = ['s', ''];
            const sessionP = Q.ninvoke(svc, 'OpenSession', 'plain', emptyStringVariant);
            const itemsP = Q.ninvoke(svc, 'SearchItems', attrs);
            return sessionP.then(
                ([_out, session]) => itemsP.then(
                    ([unlocked, locked]) => Q.ninvoke(svc, 'GetSecrets', unlocked, session)));
        }).then(secrets => friendly(secrets[0]))

        return secretP;
    }

    return Object.freeze({
        lookup: lookup,
        subSpace: subAttrs => secretSpace(bus, attrs.concat(subAttrs))
    });
}


function makeSessionBus(env, connectAbstract) {
    const parts = (env.DBUS_SESSION_BUS_ADDRESS || '').match('([a-z]+):([a-z]+)=(.*)');
    if (!parts) throw('no DBus Session?');

    const [_all, family, property, addr] = parts;
    if (family != 'unix' || property != 'abstract') throw(`expected unix:abstract=...; got $parts`)

    console.log('DBus session addr:', addr)
    const abstractSentinel = '\u0000';
    return dbus.sessionBus({stream: connectAbstract(abstractSentinel + addr)});
}


if (require.main == module) {
    main(
        { env: process.env, argv: process.argv },
        { connectAbstract: require('abstract-socket').createConnection }
    )
}
