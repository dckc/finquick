/** roots -- find roots of capper DB

@flow
*/
/*global require, module */

'use strict';

const Q = require('q');

/*::
import typeof readFile from 'fs';
*/

function main(fs_readFile /*: readFile*/) {
    Q.nfcall(fs_readFile, 'capper.db', {encoding: 'utf8'})
        .then(data => {
            console.log(data);
        })
        .done();
}

if (require.main == module) {
    // Access ambient stuff only when invoked as main module.
    main(require('fs').readFile);
}
