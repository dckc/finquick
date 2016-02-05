/** ofxies main
global console
@flow
 */
'use strict';

require('object-assign-shim'); // ES6 Object.assign

const Q = require('q');
const parseOFX = require('banking').parse;

const freedesktop = require('./secret-tool');
const budget = require('./budget');
const OFX = require('./asOFX').OFX;
const Simple = require('./asOFX').Simple;
const makeHistoryRd = require('./bbv').makeHistoryRd;
const makeSimpleRd = require('./simpn').makeSimpleRd;


module.exports = (function Ofxies(clock, spawn, writeFile,
                                  mysql, Banking, nightmare) {
    const keyStore = freedesktop.makeSecretTool(spawn);

    const cache = mkCache(clock);

    function getStatement(start, now, creds, info) {
        const banking = new Banking(Object.assign({}, creds, info));

        console.log('getStatement:', info.fidOrg, info.url);
        return Q.ninvoke(
            banking, 'getStatement',
            {
                start: OFX.fmtDate(start),
                end: OFX.fmtDate(now)
            });
    }

    const makeDB = (optsP) => budget.makeDB(mysql, optsP);
    const debug = true;
    const bbvAux = (creds) =>
        makeHistoryRd(nightmare({show: debug}), creds);
    const simpleAux = (creds) =>
        makeSimpleRd(nightmare({show: debug}), creds);
    const sitePassword = realm =>
        keyStore.lookup({signon_realm: realm});
    const saveOFX = (code, xml) => Q.nfcall(writeFile, code + '.ofx', xml);

    return Object.freeze({
        makeBudget: makeBudgetMaker(keyStore, makeDB, saveOFX),
        makeBankBV: makeBankBVmaker(keyStore, bbvAux, cache),
        makeSimple: makeSimplemaker(sitePassword, simpleAux, cache),
        makeOFX: makeOFXmaker(keyStore, getStatement, cache)
    });
})(
    // pass in ambient stuff here
    () => new Date(),
    require('child_process').spawn,
    require('fs').writeFile,
    // TODO: we only need mysql.createConnection
    require('mysql'),
    require('banking'),
    require('nightmare'));


const hr = 60 * 60 * 1000;

function mkCache(clock) {
    return cache;

    function cache(f, mem, field, maxAgeDefault) {
        return function (x, maxAge /*: ?number */) {
            const now = clock();
            maxAge = maxAge || maxAgeDefault;
            if (mem.timestamp && (new Date(mem.timestamp + maxAge) > now)) {
                return Q(mem[field]);
            }
            return f(x, now).then(result => {
                mem[field] = result;
                mem.timestamp = now.valueOf();
                return result;
            });
        };
    }
}

function makeOFXmaker(keyStore, getStatement, cache) {
    return makeOFX;

    function makeOFX(context) {
        const mem = context.state;

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
                            .BANKTRANLIST[0].STMTTRN;
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
            fetch: cache(fetch, mem, 'stmttrn', 36 * hr)
        });
    }
}


function makeBankBVmaker(keyStore, makeBankRd, cache) {
    return makeBankBV;

    function makeBankBV(context) {
        const mem = context.state;
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
            fetch: cache(fetch, mem, 'stmttrn', 36 * hr)
        });
    }
}


function makeSimplemaker(sitePassword, makeSimpleRd, cache) {
    return makeSimple;

    function makeSimple(context) {
        const mem = context.state;
        let simple = null;

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
        const transactions_ = cache(transactions, mem, 'transactions', 36 * hr);

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
            fetch: (_startMS, _maxAge) => transactions_().then(toOFX)
        });
    }
}


function makeBudgetMaker(keyStore, makeDB, saveOFX) {
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
