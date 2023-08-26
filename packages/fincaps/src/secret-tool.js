/**
 * @file endo plugin for [FreeDesktop Secret Sevice][1]
 *
 * This implementation uses `spawn` to call gnome `secret-tool`.
 * Nearby we have code to use dbus directly, so we could do that.
 *
 * [1]: https://specifications.freedesktop.org/secret-service/latest/
 */

// @ts-check
import { Far } from '@endo/far';
import { spawn as ambientSpawn } from 'child_process';

import { withResolvers } from './withResolvers.js';

// tested with
// `apt-cache  show libsecret-tools`
// Version: 0.20.5-2
// SHA256: 2fd22e91c2e0e69f7a9e391e2be6c565d310346bbca46a7509a354cdd7d5a917
// https://launchpad.net/ubuntu/+source/libsecret/0.20.5-2 2022-02-24
// cribbed from https://github.com/drudge/node-keychain/blob/master/keychain.js
const toolPath = 'secret-tool';

/**
 * @typedef {{
 *   lookup: (what: Record<string, string>) => Promise<string>,
 *   makePassKey: (what: Record<string, string>) => PassKey,
 * }} SecretTool
 *
 * @typedef {{
 *   subKey: (subProps: Record<string, string>) => PassKey;
 *   properties: () => Record<string, string>;
 *   get: () => Promise<string>;
 * }} PassKey
 */

/**
 * @param {typeof import('child_process').spawn} spawn
 * @returns {SecretTool}
 */
export function makeSecretTool(spawn) {
  /**
   * @param {Record<string, string>} what - TODO: runtime typecheck
   */
  function lookup(what) {
    const args = ['lookup'];
    for (const [prop, val] of Object.entries(what)) {
      args.push(prop);
      args.push(val);
    }

    console.log('spawn(', toolPath, args, ')');
    const tool = spawn(toolPath, args);

    let password = '';
    tool.stdout.on('data', d => {
      password += d;
    });

    /** @type {import('./withResolvers.js').PromiseKit<string>} */
    const out = withResolvers();
    tool.on('close', (code /* , signal */) => {
      if (code !== 0) {
        return out.reject(new Error('non-zero exit from ' + toolPath));
      }

      out.resolve(password);
    });

    return out.promise;
  }

  /**
   * @param {Record<string, string>} properties
   * @returns {PassKey}
   */
  function makePassKey(properties) {
    /**
     * @param {Record<string, string>} subProps - TODO: runtime typecheck
     */
    const subKey = subProps => makePassKey({ ...properties, ...subProps });

    const key = Far('PassKey', {
      subKey,
      properties: () => properties,
      get: () => lookup(properties),
    });
    return key;
  }

  return Far('SecretTool', {
    lookup,
    makePassKey,
  });
}

/**
 * @param {string} arg1
 * @param {string[]} args
 */
export function args2props(arg1, args) {
  if (typeof arg1 === 'string') {
    const entries = args.map(arg => arg.split('='));
    const properties = Object.fromEntries(entries);
    return properties;
  } else if (typeof arg1 === 'object' && arg1 !== null) {
    return arg1;
  } else {
    return {};
  }
}

// TODO: separate module so code above can be used without node API
export const make = () => makeSecretTool(ambientSpawn);
