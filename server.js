/**
@flow
*/
/*global require, module, process */

'use strict';
const Capper = require('Capper');
const makeUnique = Capper.caplib.makeUnique;
const makeOFXies = require('./ofxies/server/main');


function main(argv, crypto, fs, path, time, proc, net, db) {
    const unique = makeUnique(crypto.randomBytes);
    const apps = { ofxies: makeOFXies(time, proc, fs, net, db, unique) };
    const dbfile = Capper.fsSyncAccess(fs, path.join, 'capper.db');
    const rd = p => Capper.fsReadAccess(fs, path.join, p);
    const configFile = rd('capper.config');
    const sslDir = rd('./ssl');
    const reviver = makeReviver();
    const saver = Capper.makeSaver(unique, dbfile, reviver.toMaker)

    Capper.makeConfig(configFile).then(config => {
        Capper.run(argv, config, reviver, saver,
                   sslDir, net.createServer, net.express);
    });

    function makeReviver() {
        function check(name, cond) {
            if (!cond) {
                console.log('cannot revive', name);
                throw new Error(name);
            }
        }

        function parseName(name) {
            const parts = name.split('.');
            check(name, parts.length == 2);
            return { app: parts[0], method: parts[1] };
        }

        return Object.freeze({
            toMaker: name => {
                const n = parseName(name);
                const maker = apps[n.app][n.method];
                check(name, maker);
                return maker;
            },
            sendUI: (res, name, path) => {
                console.log('sendUI', name, path);
                if (path) {
                    res.sendfile(`./${name}/ui/${path}`);
                } else {
                    const n = parseName(name);
                    res.sendfile(`./${n.app}/ui/${n.method}.html`);
                }
            }
        });
    }
}


if (require.main == module) {
    // Access ambient stuff only when invoked as main module.
    main(process.argv,
         require('crypto'),
         require('fs'), require('path'),
         { clock: () => new Date()},
         { spawn: require('child_process').spawn,
           pid: process.pid,
           hostname: require('os').hostname },
         { SocketServer: require('ws').Server,
           createServer: require('https').createServer,
           express: require('express'),
           Banking: require('banking'),
           browser: require('nightmare')},
         // TODO: we only need mysql.createConnection
         { mysql: require('mysql'),
           events: require('mysql-events')});
}
