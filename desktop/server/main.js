/** presence -- subscribe to presence of desktop user
 *
 * for example, to allow access only while the user is present
 */
// @flow

'use strict';

const Q = require('q');
const dbus = require('dbus-native');  // native JS, not bindings to native code

function main(process, net) {
    const sessionBus = makeSessionBus(process.env.DBUS_SESSION_BUS_ADDRESS || '',
                                      net.connectAbstract);

    const attrs = toPairs(process.argv.slice(2));
    console.log('searching with attrs:', attrs, process.argv);
    const space = secretSpace(sessionBus, {}).subSpace(DBusDict.toJS(attrs));
    space.search()
        .then(props => console.log('all about this space:', props))
        .fail(oops => console.log('no props for you:', oops));
    space.lookup()
        .then(secret => console.log('TADA!', secret))
        .fail(oops => console.log('no cookie for you:', oops));

    const doorPrize = Q.defer();
    const winner = onlyWhenPresent(sessionBus, doorPrize.promise);
    const t = setTimeout(_ => doorPrize.resolve('you win!'), 3 * 1000);

    winner
        .then(prize => console.log(prize))
        .fail(oops => console.log('must be present to win', oops));
}

function toPairs(items) {
    const out = [];
    for (let ix = 0; ix < items.length; ix += 2) {
        out.push(items.slice(ix, ix + 2));
    }
    return out;
}


/**
 * In DBus, a dictionary is an array of k, v structures.
 * Here we limit ourselves to string keys and values, as in SecretStore attributes.
 */
const DBusDict = {
    fromJS: (o /*: {[string]: string} */) => Object.keys(o).map(k => [k, o[k]]),
    toJS: (akv /*: Array<Array<string>> */) /*: {[string]: string} */ => {
        const out = {};
        for (let [k, v] of akv) {
            out[k] = v;
        }
        return out;
    }
}

/*::
// TODO: move to Capper

type Context = {
  make(reviver: string, ...args: Array<any>): Object,
  state: Object
}
 */

exports.makeAppMaker = makeAppMaker;
function makeAppMaker(env /*: {[string]: ?string} */, connectAbstract /*: string => any */) {
    let busCache = null;

    return Object.freeze({
        makeSecretSpace: makeSecretSpace
    });

    function theSessionBus() {
        if (!busCache) {
            busCache = makeSessionBus(env.DBUS_SESSION_BUS_ADDRESS || '', connectAbstract);
            console.log('connected to DBUS.');
        }
        return busCache;
    }

    function makeSecretSpace(context /*: Context */) {
        const mem = context.state;

        let spaceCache = null;

        function init(attributes /*: ?{[string]: string} */) {
            mem.attributes = attributes || {};
        }

        function theSpace() {
            if (!mem.attributes) {
                throw('Capper protocol requires init() before other methods.');
            }
            if (!spaceCache) {
                spaceCache = secretSpace(theSessionBus(), mem.attributes || {});
            }
            return spaceCache;
        }

        function subSpace(attributes /*: {[string]: string} */) {
            const makerName = 'desktop.makeSecretSpace'; // ISSUE: magic?
            const subAttrs = Object.assign({}, mem.attributes, attributes);
            return context.make(makerName, subAttrs);
        }
        return Object.freeze({
            init: init,
            search: () => theSpace().search(),
            lookup: () => theSpace().lookup(),
            subSpace: subSpace
        });
    }
}


function onlyWhenPresent(bus, p) {
    let present = false;

    bus.getService('org.gnome.ScreenSaver').getInterface(
        '/org/gnome/ScreenSaver',
        'org.gnome.ScreenSaver', function(err, screensaver) {
            if(err) {
                console.log(err);
            }
            // console.log('got interface: ', screensaver);
            screensaver.GetActive((err, screenBlanked) => {
                present = !screenBlanked;
                // console.log('initially blanked?', screenBlanked, 'present?', present);
            });

            // dbus signals are EventEmitter events
            screensaver.on('ActiveChanged', function(screenBlanked) {
                present = !screenBlanked;
                console.log('ActiveChanged', screenBlanked, 'present?', present);
            });
        });

    return p.then(x => {
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


function secretSpace(bus, attrs /*: {[string]: string} */) {
    const secretService = bus.getService('org.freedesktop.secrets');

    function lookup() {
        const [itemsP, svcP] = itemsAndService();
        const secretP = svcP.then(svc => {
            const emptyStringVariant = ['s', ''];
            const sessionP = Q.ninvoke(svc, 'OpenSession', 'plain', emptyStringVariant);
            return sessionP.then(
                ([_out, session]) => itemsP.then(
                    ([unlocked, locked]) => Q.ninvoke(svc, 'GetSecrets', unlocked, session)));
        }).then(secrets => friendly(secrets[0]))

        return secretP;
    }

    function itemsAndService() {
        const svcP = Q.ninvoke(secretService, 'getInterface',
                               '/org/freedesktop/secrets', 'org.freedesktop.Secret.Service');
        return [svcP.then(svc => Q.ninvoke(svc, 'SearchItems', DBusDict.fromJS(attrs))), svcP];
    }

    function friendly(key_parts) {
        // we use 'plain', so output is always ''
        let [key, [_secretSession, _output, secret, mediaType]] = key_parts;
        return {
            item: key,
            // secretSession: secretSession,  // let's not leak this
            secret: secret.toString(),
            mediaType: mediaType
        };
    }


    function search() {
        const [itemsP, svcP] = itemsAndService();

        return itemsP.then(([unlocked, locked]) => Q.all(unlocked.map(properties)));

        function properties(itemPath) {
            // console.log('item path?', itemPath);
            const itemP = Q.ninvoke(secretService, 'getInterface',
                                    itemPath,
                                    'org.freedesktop.DBus.Properties');
            return itemP
                .then(item => Q.ninvoke(item, 'GetAll', 'org.freedesktop.Secret.Item'))
                .then(props => dict2object(props, 'v'));
        }

        function decode(val, ty, ch) {
            switch (ty) {
            case 'b':
            case 's':
            case 't':
                return val;
            case 'v':
                const [[{"type": vtyp, "child": [vch]}], [vv]] = val;
        return decode(vv, vtyp, vch);
            case 'a':
                if (ch.type == '{') {
                    return dict2object(val, ch.child[1].type);
                } else {
                    throw(['@@TODO:', JSON.stringify([val, ty, ch])]);
                }
            default:
                throw('what type is that?' + ty);
            }
        }
        // We assume key type is atomic.
        function dict2object(items, valty) {
            const out = {};
            for (let [k, v] of items) {
                out[k] = decode(v, valty, {});
            }
            return out;
        }
    }

    console.log('new secret space with attrs:', attrs);
    return Object.freeze({
        lookup: lookup,
        search: search,
        subSpace: subAttrs => secretSpace(bus, Object.assign({}, attrs, subAttrs))
    });
}


function makeSessionBus(addr, connectAbstract) {
    const parts = addr.match('([a-z]+):([a-z]+)=(.*)');
    if (!parts) throw('no DBus Session?');

    const [_all, family, property, path] = parts;
    if (family != 'unix' || property != 'abstract') throw(`expected unix:abstract=...; got $parts`);

    // console.log('DBus session path:', path)
    const abstractSentinel = '\u0000';
    const stream = connectAbstract(abstractSentinel + path);
    return dbus.sessionBus({stream: stream});
}


if (require.main == module) {
    main(
        { env: process.env, argv: process.argv },
        { connectAbstract: require('abstract-socket').createConnection }
    )
}
