/*global console */
'use strict';

require('object-assign-shim'); // ES6 Object.assign

var Q = require('q');
var freedesktop = require('./secret-tool');
var GnuCash = require('./budget');  // still thinking about what goes where

module.exports = (function Ofxies(clock, spawn, mysql, Banking) {
    var institutionDB = {
        discover: {
            fid: 7101
            , fidOrg: 'Discover Financial Services'
            , url: 'https://ofx.discovercard.com'
            , bankId: null /* not a bank account */
            , accType: 'CREDITCARD'
        },
        amex: {
            fid: 3101
            , fidOrg: 'American Express Card'
            , url: 'https://online.americanexpress.com/myca/ofxdl/desktop/desktopDownload.do?request_type=nl_ofxdownload'
            , bankId: null /* not a bank */
            , accType: 'CREDITCARD'
        }
    };


    function makeInstitution(context) {
        var mem = context.state;

        return Object.freeze({
            init: function(key) {
                var info = institutionDB[key];
                if (!info) {
                    throw('banking institution not known: ' + key);
                }
                console.log('Intsitution.init: ', key, info);

                mem.info = info;
            },
            info: function() {
                return mem.info;
            },
            getStatement: function getStatement(creds, daysAgo) {
                var now = clock(); // TODO: return a promise from clock()?
                var banking = new Banking(Object.assign({}, creds, mem.info));

                console.log('getStatement:', mem.info.fidOrg, mem.info.url);
                return Q.ninvoke(
                    banking, 'getStatement',
                    {
                        start: ofxDateFmt(daysBefore(daysAgo, now)),
                        end: ofxDateFmt(now)
                    });
            }
        });
    }

    function makeAccount(context) {
        var mem = context.state;

        return Object.freeze({
            init: function(institution, passKey) {
                mem.institution = institution;
                mem.passKey = passKey;
            },
            name: function() {
                return mem.passKey.properties()['object'];
            },
            institution: function() {
                return mem.institution;
            },
            fetch: function() {
                return mem.passKey.get().then(function(secret) {
                    var daysAgo = 60,
                        parts = secret.trim().split(' '),
                        creds = { accId: parts[0],
                                  user: parts[1],
                                  password: parts[2] };

                    return mem.institution.getStatement(creds, daysAgo);
                });
            }
        });
    }

    const keyStore = freedesktop.makeSecretTool(spawn);
    function makePassKey(context) {
        const mem = context.state;

        return Object.freeze({
            init: function(/*... etc*/) {
                const arg0 = arguments[0];
                const etc = Array.prototype.slice.call(arguments, 0);
                const props = freedesktop.args2props(arg0, etc);
                mem.properties = props;
            },
            subKey: function(/*, etc*/) {
                const arg0 = arguments[0];
                const etc = Array.prototype.slice.call(arguments, 0);
                const props = Object.assign(
                    {},
                    mem.properties,
                    freedesktop.args2props(arg0, etc));

                return context.make('ofxies.makePassKey', props);
            },
            properties: () => mem.properties,
            get: () => keyStore.lookup(mem.properties)
        });
    }

    function makeGnuCashDB(context) {
        var mem = context.state;
        var optsP, db;

        function ensureDB(){
            if (!db) {
                optsP = mem.passKey.get().then(function(password) {
                    return Object.assign({},
                                         { password: password },
                                         mem.properties);
                });
                db = GnuCash.makeDB(mysql, optsP);
            }
            return db;
        }

        return Object.freeze({
            init: function(passKey /*, etc*/) {
                var etc = Array.prototype.slice.call(arguments, 1);
                mem.passKey = passKey;
                mem.properties = freedesktop.args2props(null, etc);
            },
            query: function query(dml, params) {
                return ensureDB().query(dml, params);
            },
            destroy: function() { ensureDB().end(); }
        });
    }

    return Object.freeze({
        makeAccount: makeAccount,
        makeInstitution: makeInstitution,
        makePassKey: makePassKey,
        makeGnuCashDB: makeGnuCashDB
    });
})(
    // pass in ambient stuff here
    () => new Date(),
    require('child_process').spawn,
    require('mysql'),
    require('banking'));

function ofxDateFmt(d) {
    return d.toISOString().substring(0, 20).replace(/[^0-9]/g, '');
}

function daysBefore(n, d) {
    var msPerDay = 24 * 60 * 60 * 1000;
    return new Date(d.getTime() - n * msPerDay);
}
