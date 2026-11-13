/**
 * @file Vats kept with their bundles, without a toybox: upgraded only
 * when their code changed.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { E, Far } from '@endo/far';
import { makeUpgrader } from '../boot/boot/upgrade.js';

/**
 * @import { Powers } from '@vattr/toybox/src/types.ts';
 * @import { BundleCap, Code } from '../devices.ts';
 */

/** A boot directory whose files' bundleCaps change when `edit` does, and a vatAdmin that logs what it does. */
const makeKernel = () => {
  /** @type {string[]} */
  const log = [];
  /** @type {Record<string, number>} */
  const edits = {};
  // a bundleCap is opaque; a name stands in for one
  /** @param {string} file */
  const capOf = file =>
    /** @type {BundleCap} */ (
      /** @type {unknown} */ (`bundle:${file}@${edits[file] ?? 0}`)
    );
  let n = 0;
  const bundles = Far('bundles', {
    getBundleCap: async (/** @type {string} */ file) => capOf(file),
  });
  const vatAdmin = Far('vatAdmin', {
    /** @param {BundleCap} bundle */
    createVat: async bundle => {
      const vat = `v${(n += 1)}`;
      log.push(`create ${vat} ${bundle}`);
      return {
        root: vat,
        adminNode: Far('adminNode', {
          /** @param {BundleCap} to */
          upgrade: async to => void log.push(`upgrade ${vat} ${to}`),
          restart: () => {},
        }),
      };
    },
  });
  /** @param {string} file */
  const edit = file => (edits[file] = (edits[file] ?? 0) + 1);
  return { log, bundles, vatAdmin, edit };
};

test('a vat is upgraded only when its code changed, and keeps its root', async () => {
  const { log, bundles, vatAdmin, edit } = makeKernel();
  // the fake vatAdmin's roots are names
  const code =
    /** @type {Record<'a' | 'b', Code<(p: Powers, q: {}) => any>>} */ ({
      a: 'a.js',
      b: 'b.js',
    });
  const vats = makeUpgrader(E, { vatAdmin, bundles }, code);

  const a = await vats.create('a', {});
  assert.equal(
    await vats.upgrade('a', a),
    a,
    'unchanged code: the same record',
  );
  edit('a.js');
  const a1 = await vats.upgrade('a', a);
  assert.equal(a1.root, a.root);
  assert.equal(a1.bundle, 'bundle:a.js@1');

  const b = await vats.create('b', {});
  const each = await vats.upgradeEach({ b });
  assert.equal(each.b, b, 'unchanged code: the same record');
  edit('b.js');
  assert.equal((await vats.upgradeEach({ b })).b.bundle, 'bundle:b.js@1');

  assert.deepEqual(log, [
    'create v1 bundle:a.js@0',
    'upgrade v1 bundle:a.js@1',
    'create v2 bundle:b.js@0',
    'upgrade v2 bundle:b.js@1',
  ]);
});
