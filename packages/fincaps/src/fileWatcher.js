/**
 * @file File Watcher endo plugin
 *
 * Goal: watch for certain downloads:
 *
 * downloads.on('add', { ignore: n => !n.startsWith('dxweb') }, stmt => {... })
 */

// @ts-check

import { E, Far } from '@endo/far';
import { M, mustMatch } from '@endo/patterns';

import { pathToFileURL, fileURLToPath } from 'url';
import { minimatch } from 'minimatch';

// https://www.npmjs.com/package/watcher
import AmbientWatcher from 'watcher';

const noopts = harden({});

/**
 * @param {string} root
 * @param {{
 *  makeWatcher: (...ps: ConstructorParameters<typeof AmbientWatcher>) => AmbientWatcher
 * }} io
 */
const makeFileWatcher = (root, { makeWatcher }) => {
  const watch = (here, opts = noopts) => {
    const { glob } = opts;
    const opts2 = { ...(glob ? { ignore: p => !minimatch(p, glob) } : {}) };
    const w = makeWatcher(here, opts2);
    const self = Far('FileWatcher', {
      subWatcher: (ref = '.', moreOpts = noopts) => {
        mustMatch(ref, M.string());
        mustMatch(moreOpts, M.recordOf(M.string(), M.any()));
        const there = fileURLToPath(new URL(ref, pathToFileURL(here)));
        return watch(there, { ...opts, ...moreOpts });
      },
      on: (event, handler) => {
        mustMatch(event, M.string()); // 'add', ...
        mustMatch(handler, M.eref(M.remotable()));
        console.log('registered:', { here, event, handler });
        w.on(
          event,
          (event, targetPath) => void E(handler).handle(event, targetPath),
        );
      },
    });
    return self;
  };
  return watch(root);
};

export const make = _powers =>
  makeFileWatcher(fileURLToPath('file:///'), {
    makeWatcher: (...args) => new AmbientWatcher(...args),
  });
