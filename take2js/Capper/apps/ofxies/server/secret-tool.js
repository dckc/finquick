const Q = require('q');

function makeSecretTool(spawn) {
    'use strict';

    // cribbed from https://github.com/drudge/node-keychain/blob/master/keychain.js
    const toolPath = 'secret-tool';

    function lookup(what) {
        const args = ['lookup'];
        for (let prop in what) {
            args.push(prop);
            args.push(what[prop]);
        }


        console.log('spawn(', toolPath, args, ')');
        const tool = spawn(toolPath, args);

        let password = '';
        tool.stdout.on('data', d => { password += d; });

        const out = Q.defer();
        tool.on('close', (code /* , signal */) => {
            if (code !== 0) {
                return out.reject(new Error('non-zero exit from ' + toolPath));
            }

            out.resolve(password);
        });

        return out.promise;
    }

    return Object.freeze({
        lookup: lookup,
        path: () => toolPath
    });
}

exports.makeSecretTool = makeSecretTool;
