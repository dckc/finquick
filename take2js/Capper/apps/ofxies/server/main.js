/*global console */

module.exports = function Ofxies(context) {
    "use strict";

    var mem = context.state;

    return Object.freeze({
        init: function(description, url, username, password, acct) {
            mem.description = description;
            mem.url = url;
            mem.username = username;
            mem.password = password;
            mem.acct = acct;
        },
        link: function() {
            return { description: mem.description, url: mem.url };
        }
    });
};
