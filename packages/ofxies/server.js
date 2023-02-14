/**
@flow
*/
/*global require, module, process */

'use strict';
const Capper = require('Capper');
const docopt = require('docopt').docopt;
const makeUnique = Capper.caplib.makeUnique;
const makeOFXies = require('./ofxies/server/main');
const desktop = require('./desktop/server/main');

const usage = `
Usage:
  server.js make REVIVER [ARG...]
  server.js post WEBKEY METHOD [ARG...]
  server.js drop WEBKEY
  server.js

Options:
 -h --help              show usage

`;

function main(argv, crypto, fs, path, time, proc, net, db) {
    const unique = makeUnique(crypto.randomBytes);
    const apps = {
        ofxies: makeOFXies(time, proc, fs, net, db, unique),
        desktop: desktop.makeAppMaker(proc.env, net.connectAbstract),
    };
    const dbfile = Capper.fsSyncAccess(fs, path.join, 'capper.db');
    const rd = p => Capper.fsReadAccess(fs, path.join, p);
    const configFile = rd('capper.config');
    const sslDir = rd('./ssl');
    const reviver = makeReviver();
    const saver = Capper.makeSaver(unique, dbfile, reviver.toMaker)

    Capper.makeConfig(configFile).then(config => {
        if (command(config)) {
            return;
        } else {
            console.log('start: ', time.clock());
            Capper.run(argv, config, reviver, saver,
                       sslDir, net.createServer, net.express);
        }
    });

    function command(config) {
        const cli = docopt(usage, { argv: argv.slice(2) });

        const sturdy = Capper.makeSturdy(saver, config.domain);
        const parseArg = Capper.caplib.makeParseArg(sturdy.wkeyStringToLive);
        
        if (cli["drop"]) {
            saver.drop(saver.credToId(parseArg(cli["WEBKEY"])));
            saver.checkpoint().then(() => console.log("drop done"));
        } else if (cli["make"]){
            const msg = [cli["REVIVER"]].concat(cli["ARG"].map(parseArg));
            const obj = saver.make.apply(undefined, msg);
            if (!obj) {console.error("cannot find maker " + cli["REVIVER"]); return true;}
            saver.checkpoint().then(
                () => console.log(sturdy.idToWebkey(saver.asId(obj)))
            ).done();
        } else if (cli["post"]) {
            const rx = sturdy.wkeyStringToLive(cli["WEBKEY"].substring(1));
            if (typeof rx !== "object") {
                console.error("bad target object webkey; forget '@'?");
            } else {
                const vowAns = saver.deliver(saver.asId(rx), cli["METHOD"], ...cli["ARG"].map(parseArg));
                sturdy.vowAnsToVowJSONString(vowAns).then(
                    answer => console.log(answer));
            }
        } else {
            return false;
        }

        return true;
    }
    
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
           env: process.env,
           hostname: require('os').hostname },
         { SocketServer: require('ws').Server,
           createServer: require('https').createServer,
           connectAbstract: require('abstract-socket').createConnection,
           express: require('express'),
           account: require('bank').account,
           Banking: require('banking'),
           browser: require('nightmare')},
         // TODO: we only need mysql.createConnection
         { mysql: require('mysql'),
           events: require('mysql-events')});
}
