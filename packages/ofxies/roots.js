/** roots -- find roots of capper DB

@flow
*/
/*global require, module, console */

'use strict';

const Q = require('q');

/*::
import {typeof readFile as readFile_t} from 'fs';
*/

const CAPPER_DB = 'capper.db';


function main(readFile /*: readFile_t*/,
              stdout /*: typeof process.stdout */) {
    Q.nfcall(readFile, CAPPER_DB, {encoding: 'utf8'})
        .then(text => showRoots(JSON.parse(text)))
        .done();

    function showRoots(db) {
        console.error(`db keys: ${Object.keys(db).length}`);
        const roots = dbRoots(db);
        console.error(`roots: ${roots.length}`);
        roots.forEach(o => {
            stdout.write(`${JSON.stringify(o)}\n`);
        });
    }
}

function dbRoots(db /*: {string: Object} */) /*: Array<[string, Object]>*/ {
    const setDiff = (a, b) => a.filter(v => ! b.includes(v));

    return setDiff(Object.keys(db), refs(db)).map(k => [k, db[k].reviver]);
}

function refs(value /*:any*/) /*: Array<string>*/ {
    const flatten = arrays => [].concat.apply([], arrays);

    if (value === null || typeof value !== 'object') {
        return [];
    } else {
        if ('@id' in value) {
            return [value['@id']];
        } else {
            return flatten(Object.keys(value).map(k => refs(value[k])));
        }
    }
}


if (require.main == module) {
    // Access ambient stuff only when invoked as main module.
    main(require('fs').readFile,
         process.stdout);
}
