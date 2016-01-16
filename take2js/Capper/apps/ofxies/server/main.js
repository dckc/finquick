/** ofxies main
global console
@flow
 */
'use strict';

require('object-assign-shim'); // ES6 Object.assign

var Q = require('q');
var freedesktop = require('./secret-tool');
var budget = require('./budget');
var OFX = require('./asOFX').OFX;

module.exports = (function Ofxies(clock, spawn, mysql, Banking) {
    const keyStore = freedesktop.makeSecretTool(spawn);

    function makeOFX(context) {
        const mem = context.state;

        const fetch = function (daysAgo) {
            return keyStore.lookup(mem.keyAttrs).then(secret => {
                const parts = secret.trim().split(' ');
                return { accId: parts[0],
                         user: parts[1],
                         password: parts[2] };
            }).then(creds => {
                var now = clock(); // TODO: return a promise from clock()?
                var banking = new Banking(Object.assign({}, creds, mem.info));

                console.log('getStatement:', mem.info.fidOrg, mem.info.url);
                return Q.ninvoke(
                    banking, 'getStatement',
                    {
                        start: OFX.fmtDate(daysBefore(daysAgo || 60, now)),
                        end: OFX.fmtDate(now)
                    }).then(reply =>
                            reply.body.OFX
                            .CREDITCARDMSGSRSV1[0].CCSTMTTRNRS[0].CCSTMTRS[0]
                            .BANKTRANLIST[0].STMTTRN);
            });
        };

        return Object.freeze({
            init: function(institutionKey /*, etc.*/) {
                var info = OFX.institutionInfo[institutionKey];
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
            fetch: fetch
        });
    }

    function makeBudget(context) {
        var mem = context.state;
        var chart = mem.opts ? makeChart(mem.opts) : null;

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

            const db = budget.makeDB(mysql, dbOptsP);
            return budget.makeChartOfAccounts(db);
        }

        const fetch = (code, daysAgo) => mem.remotes[code].fetch(daysAgo);
        const fetchNew = (code, daysAgo) => {
            return fetch(code, daysAgo).then(txns => {
                console.log('fetchNew txns qty:', txns.length);
                return theChart().filterSeen(code, txns);
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
            fetchNew: fetchNew,
            destroy: function() {
                theChart().destroy();
                context.destroy();
            }
        });
    }

    return Object.freeze({
        makeBudget: makeBudget,
        makeOFX: makeOFX
    });
})(
    // pass in ambient stuff here
    () => new Date(),
    require('child_process').spawn,
    require('mysql'),
    require('banking'));

function daysBefore(n, d) {
    var msPerDay = 24 * 60 * 60 * 1000;
    return new Date(d.getTime() - n * msPerDay);
}
