/*global console */

require('object-assign-shim'); // ES6 Object.assign

var Banking = require('banking');
var Q = require('q');
var freedesktop = require('./budget');  // secretTool is there for now
var GnuCash = require('./budget');  // still thinking about what goes where

module.exports = function Ofxies() {
    'use strict';

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
                // ambient authority :-/
                var now = new Date();
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

    function makeKeyStore(context) {
        var spawn = require('child_process').spawn; // boo! ambient
        var tool = freedesktop.makeSecretTool(spawn);

        return Object.freeze({
            lookup: function(what) {
                return tool.lookup(what);
            }
        });
    }

    function makePassKey(context) {
        var mem = context.state;

        return Object.freeze({
            init: function(store /*, etc*/) {
                var etc = Array.prototype.slice.call(arguments, 1);
                mem.properties = args2props(etc);
                mem.store = store;
            },
            properties: function() { return mem.properties; },
            get: function() {
                return mem.store.lookup(mem.properties);
            }
        });
    }

    function makeGnuCashDB(context) {
        var mem = context.state;
        var mysql = require('mysql');
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
                mem.properties = args2props(etc);
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
        makeKeyStore: makeKeyStore,
        makePassKey: makePassKey,
        makeGnuCashDB: makeGnuCashDB
    });
}();

function args2props(args) {
    var properties = {};
    for (var i=0; i < args.length; i += 2) {
        properties[args[i]] = args[i + 1];
    }
    return properties;
}

function ofxDateFmt(d) {
    return d.toISOString().substring(0, 20).replace(/[^0-9]/g, '');
}

function daysBefore(n, d) {
    var msPerDay = 24 * 60 * 60 * 1000;
    return new Date(d.getTime() - n * msPerDay);
}
