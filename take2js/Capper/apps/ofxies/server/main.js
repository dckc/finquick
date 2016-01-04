/*global console */

require('object-assign-shim'); // ES6 Object.assign

var Banking = require('banking');
var Q = require('q');
var freedesktop = require('./budget');  // secretTool is there for now

module.exports = function Ofxies() {
    'use strict';

    // hmm... ambient authority.
    var clock = function() { return new Date(); };

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
            init: function(info) {
                mem.info = info;
            },
            info: function() {
                return mem.info;
            }
        });
    }

    function makeAccount(context) {
        var mem = context.state;

        return Object.freeze({
            init: function(institutionKey) {
                var info = institutionDB[institutionKey];
                if (!info) {
                    throw('not known: ' + institutionKey);
                }
                console.log(institutionKey, info);
                mem.institution = context.make('ofxies.makeInstitution', info);
            },
            logIn: function(accId, user, password) {
                console.log('logIn...', accId, user);
                mem.accId = accId;
                mem.user = user;
                mem.password = password;
            },
            info: function() {
                return { user: mem.user, accId: mem.accId };
            },
            institution: function() {
                return mem.institution;
            },
            fetch: function() {
                var opts = Object.assign(
                    { accId: mem.accId,
                      user: mem.user,
                      password: mem.password },
                    mem.institution.info());
                console.log('fetch:', opts);
                // ugh... Banking carries ambient net access authority
                var myCard = new Banking(opts);

                var now = clock();

                return Q.ninvoke(
                    myCard, 'getStatement',
                    {
                        start: ofxDateFmt(daysBefore(60, now)),
                        end: ofxDateFmt(now)
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
                var properties = {};
                for (var i=1; i + 1 < arguments.length; i += 2) {
                    properties[arguments[i]] = arguments[i + 1];
                }
                mem.properties = properties;
                mem.store = store;
            },
            get: function() {
                return mem.store.lookup(mem.properties);
            }
        });
    }

    return Object.freeze({
        makeAccount: makeAccount,
        makeInstitution: makeInstitution,
        makeKeyStore: makeKeyStore,
        makePassKey: makePassKey
    });
}();

function ofxDateFmt(d) {
    return d.toISOString().substring(0, 20).replace(/[^0-9]/g, '');
}

function daysBefore(n, d) {
    var msPerDay = 24 * 60 * 60 * 1000;
    return new Date(d.getTime() - n * msPerDay);
}
