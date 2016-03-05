/**
@flow
*/

'use strict';

const Q = require('q');

exports.makeSecretTool = makeSecretTool;
function makeSecretTool(spawn) {
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

    function makePassKey(tool, properties) {
        return Object.freeze({
            subKey: (subProps) => makePassKey(
                tool,
                Object.assign({}, properties, subProps)),
            properties: () => properties,
            get: () => tool.lookup(properties)
        });
    }

    return Object.freeze({
        lookup: lookup,
        makePassKey: makePassKey
    });
}

exports.args2props = args2props;
function args2props(arg1 /*: string*/, args /*: Array<string>*/) /*:Object*/{
    if (typeof arg1 === 'string') {
        const properties = {};
        for (let i=0; i < args.length; i += 1) {
            let kv = args[i].split('=');  // no destructuring let in node yet?
            properties[kv[0]] = kv[1];
        }
        return properties;
    } else if (typeof arg1 === 'object' && arg1 !== null) {
        return arg1;
    } else {
        return {};
    }
}
