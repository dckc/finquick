/** presence -- subscribe to presence of desktop user
 *
 * for example, to allow access only while the user is present
 */


var dbus = require('dbus-native');

function main(process, net) {
    const sessionBus = makeSessionBus(process.env, net.connectAbstract);

    sessionBus.getService('org.gnome.ScreenSaver').getInterface(
        '/org/gnome/ScreenSaver',
        'org.gnome.ScreenSaver', function(err, screensaver) {
            if(err) {
                console.log(err)
            }
            console.log('got interface: ', screensaver)
            // dbus signals are EventEmitter events
            screensaver.on('ActiveChanged', function() {
                console.log('ActiveChanged', arguments);
            });
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
        { env: process.env },
        { connectAbstract: require('abstract-socket').createConnection }
    )
}
