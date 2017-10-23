/*globals require describe it console */
"use strict";

const assert = require('assert');
const OFX = require('../asOFX').OFX;

describe('OFX', () => {
    describe('parseDate', () => {

        it('OFX date', function() {
            assert.equal(OFX.parseDate('20160108170000.000').toISOString(),
                         '2016-01-08T17:00:00.000Z');
        });

        it('OFX date with timezone offset', function() {
            assert.equal(OFX.parseDate('20151229050000.000[-7:MST]').toISOString(),
                         '2015-12-28T22:00:00.000Z');
        });
    });
});
