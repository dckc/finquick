/** ofxies main

requires: Capper express app

@flow
 */
/* jshint esversion: 6, node: true */

'use strict';

require('object-assign-shim'); // ES6 Object.assign

const Q = require('q');

const freedesktop = require('./secret-tool');
const budget = require('./budget');
const OFX = require('./asOFX').OFX;
const bbv = require('./bbv');
const simpn = require('./simpn');
const paypal = require('./paypalSite');

const debug = true;

const hr = 60 * 60 * 1000;

const cfg = {
    ssl_key: 'ssl/server.key',
    ssl_cert: 'ssl/server.crt',
    port: 8765
};


module.exports = Ofxies;
function Ofxies(time /*: { clock: () => Date }*/,
                proc, fs, net, db,
                unique /*: () => string*/) /*: Object*/
{
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
    const secrets = {
        sitePassword: realm =>
            keyStore.lookup({signon_realm: realm}),
        challenge: (code, question) =>
            keyStore.lookup({code: code, question: question})
    };
    const saveOFX = (code, xml) =>
        Q.nfcall(fs.writeFile, code + '.ofx', xml);
    const mkSocket = socketMaker({ createServer: net.createServer,
                                   SocketServer: net.SocketServer},
                                 { readFile: fs.readFile}, cfg);
    const mkUA = () => net.browser({show: debug});
    const mkAA = () => ({ account: net.account, end: () => null });

    return Object.freeze({
        makeBudget: makeBudgetMaker(keyStore, makeDB, mkSocket,
                                    saveOFX, unique),
        makePayPal: makeOFXSiteMaker(
            secrets, cache, mkUA, paypal.driver()),
        makeBankBV: makeOFXSiteMaker(
            secrets, cache, mkUA, bbv.driver()),
        makeSimple: makeOFXSiteMaker(
            secrets, cache, mkAA, simpn.driver()),
        makeOFX: makeOFXmaker(keyStore, getStatement, cache)
    });
}


function mkCache(clock, maxAgeDefault) {
    return cache;

    function cache(f, mem) {
        return function (x, maxAge /*: number */) {
            const now = clock();
            maxAge = maxAge >= 0 ? maxAge : maxAgeDefault;
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

        // Discover gives bogus <TRNAMT>-0</TRNAMT> transactions.
        const notBogus = tx => tx.TRNAMT != '-0';

        const fetch = function (startMS /*: ?number */, now /*: Date*/) {
            const start = startMS ? daysBefore(3, new Date(startMS))
                : daysBefore(45, now);

            // TODO: attenuate keystore? do we really need access to all of it?
            return keyStore.lookup(mem.keyAttrs).then(secret => {
                const parts = secret.trim().split(' ');
                return { accId: parts[0],
                         user: parts[1],
                         password: parts[2] };
            }).then(creds => {
                return getStatement(start, now, creds, mem.info)
                    .then(reply => {
                        const trnrs = reply.body.OFX
                              .CREDITCARDMSGSRSV1.CCSTMTTRNRS;
                        console.log('got ', trnrs.length);
                        const status = trnrs.STATUS;
                        if (status.CODE != '0') {
                            console.log('fetch error:', status);
                            throw status.MESSAGE;
                        }
                        mem.xml = reply.xml;
                        return trnrs.CCSTMTRS
                            .BANKTRANLIST.STMTTRN
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
            fetch: cache(fetch, mem),
            timestamp: () => mem.timestamp
        });
    }
}


function makeOFXSiteMaker(secrets, cache, mkUserAgent, driver) {
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
            password: () => secrets.sitePassword(mem.realm),
            challenge: question => secrets.challenge(mem.code, question)
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
                .then(driver.toOFX),
            timestamp: () => mem.timestamp
        });
    }
}


function makeBudgetMaker(keyStore, makeDB, mkSocket, saveOFX, unique) {
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
            accounts: unique(),
            transactions: unique(),
            splits: unique()
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
            return remote.fetch(start, maxAge)
                .then(splits => ({
                    fetchedAt: remote.timestamp(),
                    splits: splits
                }));
        };

        const fetchNew = (code, start, maxAge) => {
            return fetch(code, start, maxAge).then(f => {
                console.log('fetchNew txns qty:', f.splits.length);
                if (f.splits.length === 0) {
                    return {
                        splits: f.splits,
                        fetchedAt: f.fetchedAt,
                        fetchedQty: f.splits.length
                    };
                }
                return theChart().filterSeen(code, f.splits, maxAge)
                    .then(splits => ({
                        splits: splits,
                        fetchedAt: f.fetchedAt,
                        fetchedQty: f.splits.length
                    }));
            });
        };
            
        return Object.freeze({
            init: function(arg0 /*, etc*/) {
                const etc = Array.prototype.slice.call(arguments, 0);
                mem.opts = freedesktop.args2props(arg0, etc);
                chart = makeChart(mem.opts);
                mem.remotes = {};
            },
            acctSearch: q => theChart().acctSearch(q),
            acctBalance: (name, ymd) => theChart().acctBalance(name, ymd),
            cashFlow: acct => theChart().cashFlow(acct),
            subscriptions: () => [cfg.port, tableSubs],
            getLedger: (name, ymd) => theChart().getLedger(name, ymd),
            setRemote: (code, remote) => {
                mem.remotes[code] = remote;
            },
            fetch: fetch,
            saveOFX: code => saveOFX(code, mem.remotes[code].ofx()),
            fetchNew: fetchNew,
            importRemote: (code, start, maxAge) => fetch(code, start, maxAge)
                .then(f => theChart().importRemote(code, f.splits)
                      .then(importQty => ({
                          fetchedAt: f.fetchedAt,
                          fetchedQty: f.splits.length,
                          importQty: importQty
                      }))),
            currentAccounts: () => theChart().currentAccounts(),
            recentTransactions: (qty, amt) => theChart()
                .recentTransactions(qty || 50, amt || null),
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
