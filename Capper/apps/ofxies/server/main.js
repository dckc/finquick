/** ofxies main

requires: Capper express app

@flow
 */
/*global console*/

'use strict';

require('object-assign-shim'); // ES6 Object.assign

const Q = require('q');
const parseOFX = require('banking').parse;

const caplib = require('../../../caplib');
const freedesktop = require('./secret-tool');
const budget = require('./budget');
const OFX = require('./asOFX').OFX;
const Simple = require('./asOFX').Simple;
const makeHistoryRd = require('./bbv').makeHistoryRd;
const makeSimpleRd = require('./simpn').makeSimpleRd;
const paypal = require('./paypalSite');

const debug = true;

const hr = 60 * 60 * 1000;

const cfg = {
    ssl_key: 'ssl/server.key',
    ssl_cert: 'ssl/server.crt',
    port: 8765
};


module.exports = (function Ofxies(time, proc, fs, net, db) {
    // console.log('Ofxies...');
    const keyStore = freedesktop.makeSecretTool(proc.spawn);

    const cache = mkCache(time.clock, 18 * hr);

    function getStatement(start, now, creds, info) {
        const banking = new net.Banking(Object.assign({}, creds, info));

        console.log('getStatement:', info.fidOrg, info.url);
        return Q.ninvoke(banking, 'getStatement',
                         { start: OFX.fmtDate(start), end: OFX.fmtDate(now) });
    }

    const makeDB = (optsP) => budget.makeDB(
        db.mysql, db.events,
        { pid: proc.pid, hostname: proc.hostname },
        optsP);
    const bbvAux = (creds) =>
        makeHistoryRd(net.browser({show: debug}), creds);
    const simpleAux = (creds) =>
        makeSimpleRd(net.browser({show: debug}), creds);
    const sitePassword = realm =>
        keyStore.lookup({signon_realm: realm});
    const saveOFX = (code, xml) =>
        Q.nfcall(fs.writeFile, code + '.ofx', xml);
    const mkSocket = socketMaker({ createServer: net.createServer,
                                   SocketServer: net.SocketServer},
                                 { readFile: fs.readFile}, cfg);
    const mkUA = () => net.browser({show: debug});

    return Object.freeze({
        makePayPal: makeOFXSiteMaker(
            sitePassword, cache, mkUA, paypal.driver()),
        makeBudget: makeBudgetMaker(keyStore, makeDB, mkSocket, saveOFX),
        makeBankBV: makeBankBVmaker(keyStore, bbvAux, cache),
        makeSimple: makeSimplemaker(sitePassword, simpleAux, cache),
        makeOFX: makeOFXmaker(keyStore, getStatement, cache)
    });
})(
    // pass in ambient stuff here
    { clock: () => new Date()},
    { spawn: require('child_process').spawn,
      pid: process.pid,
      hostname: require('os').hostname },
    { readFile: require('fs').readFile,
      writeFile: require('fs').writeFile},
    { SocketServer: require('ws').Server,
      createServer: require('https').createServer,
      Banking: require('banking'),
      browser: require('nightmare')},
    // TODO: we only need mysql.createConnection
    { mysql: require('mysql'),
      events: require('mysql-events')});


function mkCache(clock, maxAgeDefault) {
    return cache;

    function cache(f, mem) {
        return function (x, maxAge /*: ?number */) {
            const now = clock();
            maxAge = maxAge > 0 ? maxAge : maxAgeDefault;
            if (mem.timestamp && (new Date(mem.timestamp + maxAge) > now)) {
                return Q(mem.cache);
            }
            // TODO: return cache, filter details to UI
            console.log('min. cache stale:',
                        (now - new Date(mem.timestamp + maxAge)) / (1000 * 60),
                        'maxAge (hr):', maxAge / (1000 * 60 * 60));
            return f(x, now).then(result => {
                mem.cache = result;
                mem.timestamp = now.valueOf();
                return result;
            });
        };
    }
}


function socketMaker(net, fs, cfg) {
    const ok = (_req, res) => {
        res.writeHead(200);
        res.end('Rock on.');
    };

    const read = path => Q.nfcall(fs.readFile, path);
    const mkSocket = () => Q.spread(
        [read(cfg.ssl_key), read(cfg.ssl_cert)],
        (key, cert) => {
            const https = net.createServer(
                {key: key, cert: cert}, ok);
            https.listen(cfg.port);
            // console.log('https:', https);
            const ws = new net.SocketServer({ server: https });
            // console.log('socket:', ws);
            return ws;
        });
    return mkSocket;
}


function makeOFXmaker(keyStore, getStatement, cache) {
    return makeOFX;

    function makeOFX(context) {
        const mem = context.state;
        // @@transition
        if (mem.stmttrn) {
            mem.cache = mem.stmttrn;
            mem.stmttrn = '';
        }

        // Discover gives bogus <TRNAMT>-0</TRNAMT> transactions.
        const notBogus = tx => {
            return tx.TRNAMT[0] != '-0';
        };

        const fetch = function (startMS /*: ?number */, now /*: Date*/) {
            const start = startMS ? daysBefore(3, new Date(startMS))
                : daysBefore(45, now);

            return keyStore.lookup(mem.keyAttrs).then(secret => {
                const parts = secret.trim().split(' ');
                return { accId: parts[0],
                         user: parts[1],
                         password: parts[2] };
            }).then(creds => {
                return getStatement(start, now, creds, mem.info)
                    .then(reply => {
                        const trnrs = reply.body.OFX
                            .CREDITCARDMSGSRSV1[0].CCSTMTTRNRS[0];
                        const status = trnrs.STATUS[0];
                        if (status.CODE[0] != '0') {
                            console.log('fetch error:', status);
                            throw new Error(status);
                        }
                        mem.xml = reply.xml;
                        return trnrs.CCSTMTRS[0]
                            .BANKTRANLIST[0].STMTTRN
                            .filter(notBogus);
                    });
            });
        };

        return Object.freeze({
            init: function(institutionKey /*, etc.*/) {
                const info = OFX.institutionInfo[institutionKey];
                if (!info) {
                    throw('banking institution not known: ' + institutionKey);
                }
                console.log('Institution.init: ', institutionKey, info);

                const arg1 = arguments[1];
                const etc = Array.prototype.slice.call(arguments, 1);
                const props = freedesktop.args2props(arg1, etc);
                mem.keyAttrs = props;
                mem.info = info;
            },
            institution: () => mem.info,
            name: () => mem.keyAttrs.object,
            ofx: () => mem.xml,
            fetch: cache(fetch, mem)
        });
    }
}


function makeOFXSiteMaker(sitePassword, cache, mkUserAgent, driver) {
    return makeOFXSite;

    function makeOFXSite(context) {
        const mem = context.state;

        function init(login, code, realm) {
            mem.login = login;
            mem.code = code;
            mem.realm = realm || driver.realm();
        }

        const creds = {
            login: () => Q(mem.login),
            password: () => sitePassword(mem.realm)
        };

        function download(start /*: number*/, now /*: Date*/) {
            const ua = mkUserAgent();

            return driver.download(ua, creds, start, now).then(
                data => Q.async(function*() {
                    yield ua.end();
                })().then(() => data));
        }
        const download_ = cache(download, mem);

        return Object.freeze({
            init: init,
            download: download_,
            fetch: (startMS, maxAge) => download_(startMS, maxAge)
                .then(driver.toOFX)
        });
    }
}

function makeBankBVmaker(keyStore, makeBankRd, cache) {
    return makeBankBV;

    function makeBankBV(context) {
        const mem = context.state;
        // @@transition
        if (mem.stmttrn) {
            mem.cache = mem.stmttrn;
            mem.stmttrn = '';
        }

        let sessionP = null;

        const creds = {
            username: () => Q(mem.login),
            password: () => keyStore.lookup({signon_realm: mem.realm}),
            challenge: (question) => keyStore.lookup(
                {code: mem.code, question: question})
        };

        function stmttrn(res) {
            const trnrs = res.body.OFX.BANKMSGSRSV1[0].STMTTRNRS[0];
            const status = trnrs.STATUS[0];
            if (status.CODE[0] != '0') {
                console.log('bank error:', status);
                throw new Error(status);
            }
            return trnrs.STMTRS[0]
                .BANKTRANLIST[0].STMTTRN;
        }
        
        function fetch(startMS /*: ?number */, now /*: Date*/) {
            let ofx_markup;

            if (!sessionP) {
                sessionP = makeBankRd(creds).login();
            }

            return sessionP
                .then(session => session.getHistory(new Date(startMS), now))
                .then(markup => {
                    ofx_markup = markup;
                    return Q.promise(
                        (resolve) => parseOFX(markup, resolve));
                })
                .then(
                    ofx => {
                        const txns = stmttrn(ofx);
                        mem.xml = ofx_markup;
                        return txns;
                    });
        }
        
        return Object.freeze({
            init: (login, code, realm) => {
                mem.login = login;
                mem.realm = realm || 'https://pib.secure-banking.com/';
                mem.code = code;
            },
            ofx: () => mem.xml,
            fetch: cache(fetch, mem)
        });
    }
}


function makeSimplemaker(sitePassword, makeSimpleRd, cache) {
    return makeSimple;

    function makeSimple(context) {
        const mem = context.state;
        let simple = null;
        // @@transition
        if (mem.transactions) {
            mem.cache = mem.transactions;
            mem.transactions = '';
        }

        const creds = {
            username: () => Q(mem.username),
            password: () => sitePassword(mem.realm)
        };

        function transactions(_x, _now /*: Date*/) {
            if (!simple) {
                simple = makeSimpleRd(creds);
            }

            return simple.transactions();
        }
        const transactions_ = cache(transactions, mem);

        // TODO: move this STMTRN extraction stuff to asOFX
        function toOFX(txns) {
            const stmt = Simple.statement(txns.data);
            return stmt.BANKMSGSRSV1[0].STMTTRNRS[0].STMTRS[0]
                .BANKTRANLIST[0].STMTTRN;
        }

        return Object.freeze({
            init: (username, code, realm) => {
                mem.username = username;
                mem.code = code;
                mem.realm = realm || 'https://bank.simple.com/';
            },
            transactions: transactions_,
            fetch: (startMS, maxAge) => transactions_(startMS, maxAge)
                .then(toOFX)
        });
    }
}


function makeBudgetMaker(keyStore, makeDB, mkSocket, saveOFX) {
    return makeBudget;

    function makeBudget(context) {
        let mem = context.state;
        let chart = mem.opts ? makeChart(mem.opts) : null;

        function theChart() {
            if (!chart) {
                throw new Error('no chart of accounts?!');
            }
            return chart;
        }

        const tableSubs = {
            accounts: caplib.unique(),
            transactions: caplib.unique(),
            splits: caplib.unique()
        };
        const findSubs = new Map([
            [tableSubs.accounts, 'accounts'],
            [tableSubs.transactions, 'transactions'], 
            [tableSubs.splits, 'splits'] 
        ]);

        function makeChart(opts) {
            const dbOptsP = keyStore.lookup({
                protocol: opts.protocol || 'mysql',
                server: opts.server || 'localhost',
                object: opts.object || opts.database
            }).then((password) => ({
                host: opts.host || opts.server || 'localhost',
                user: opts.user,
                password: password,
                database: opts.database
            }));

            const db = makeDB(dbOptsP);

            // TODO: manage socket lifetime so that it doesn't
            // cause -post saveOFX to linger waiting for connections.
            mkSocket().then(ws => ws.on('connection', conn => {
                // console.log('websocket connection:', ws);
                const notify = (o, n) => conn.send(JSON.stringify({
                    oldRow: o, newRow: n}));
                conn.on('message', (data, _flags) => {
                    const table = findSubs.get(data);
                    console.log('subscribe?', data, 'table:', table);
                    if (table) {
                        db.subscribe(`${opts.database}.${table}`, notify);
                    }
                });
            })).done();

            return budget.makeChartOfAccounts(db);
        }

        const fetch = (code, start, maxAge) => {
            const remote = mem.remotes[code];
            if (!remote) {
                throw new Error('no remote for account ' + code);
            }
            return remote.fetch(start, maxAge);
        };

        const fetchNew = (code, start, maxAge) => {
            return fetch(code, start, maxAge).then(txns => {
                console.log('fetchNew txns qty:', txns.length);
                return theChart().filterSeen(code, txns, maxAge);
            });
        };
            
        return Object.freeze({
            init: function(arg0 /*, etc*/) {
                const etc = Array.prototype.slice.call(arguments, 0);
                mem.opts = freedesktop.args2props(arg0, etc);
                chart = makeChart(mem.opts);
                mem.remotes = {};
            },
            acctBalance: (name, ymd) => theChart().acctBalance(name, ymd),
            subscriptions: () => [cfg.port, tableSubs],
            getLedger: (name, ymd) => theChart().getLedger(name, ymd),
            setRemote: (code, remote) => {
                mem.remotes[code] = remote;
            },
            fetch: fetch,
            saveOFX: code => saveOFX(code, mem.remotes[code].ofx()),
            fetchNew: fetchNew,
            importRemote: (code, start, maxAge) => fetch(code, start, maxAge)
                .then(txns => theChart().importRemote(code, txns)),
            currentAccounts: () => theChart().currentAccounts(),
            destroy: function() {
                theChart().destroy();
                context.destroy();
            }
        });
    }
}

function daysBefore(n /*: number*/, d /*: Date*/) /*: Date*/ {
    const msPerDay = 24 * 60 * 60 * 1000;
    return new Date(d.getTime() - n * msPerDay);
}
