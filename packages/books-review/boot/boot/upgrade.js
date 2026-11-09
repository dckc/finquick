/**
 * @file Vats kept with the bundle they run, so each start can upgrade the
 * ones whose code changed. See {@link makeUpgrader}.
 *
 * @import { Powers, Remote } from '@vattr/toybox/src/types.ts';
 * @import { AdminNode, BootBundles, BundleCap, Code, ParamsOf, RootOf, VatAdmin } from '../../devices.ts';
 */

/**
 * A vat, and the bundle it runs. Whoever holds it can upgrade or restart
 * the vat, so only its maker keeps it; others get the root.
 *
 * @template [T=unknown] what the root is
 * @typedef {{ root: Remote<T>, adminNode: Remote<AdminNode>, bundle: Remote<BundleCap> }} Kept
 */

/**
 * Makes vats from the code the boot directory has under each name, and
 * upgrades them when it changes. The same code gives the same bundleCap,
 * so the same presence: a changed bundle is a different one. An upgraded
 * vat keeps its root.
 *
 * @template {Record<string, Code>} C
 * @param {Powers['E']} E
 * @param {object} powers
 * @param {Remote<VatAdmin>} powers.vatAdmin
 * @param {Remote<BootBundles>} powers.bundles the boot directory's
 * @param {C} code each name's file in the boot directory, typed with what its vat is
 */
export const makeUpgrader = (E, { vatAdmin, bundles }, code) => {
  /** @param {keyof C} name @returns {Promise<Remote<BundleCap>>} */
  const bundleOf = name => E(bundles).getBundleCap(code[name]);

  /**
   * A new vat running `name`'s code.
   *
   * @template {keyof C} N
   * @param {N} name
   * @param {ParamsOf<C[N]>} params
   * @returns {Promise<Kept<RootOf<C[N]>>>}
   */
  const create = async (name, params) => {
    const bundle = await bundleOf(name);
    const { root, adminNode } = await E(vatAdmin).createVat(bundle, params);
    return harden({ root, adminNode, bundle });
  };

  /**
   * `kept`, upgraded to `name`'s code if it changed.
   *
   * @template T
   * @param {keyof C} name
   * @param {Kept<T>} kept
   * @returns {Promise<Kept<T>>}
   */
  const upgrade = async (name, kept) => {
    const bundle = await bundleOf(name);
    if (kept.bundle === bundle) return kept;
    await E(kept.adminNode).upgrade(bundle);
    return harden({ ...kept, bundle });
  };

  return harden({
    create,
    upgrade,
    /**
     * Each of `vats` upgraded to its code, by the name it's kept under.
     *
     * @template {Partial<Record<keyof C, Kept<any>>>} V
     * @param {V} vats
     * @returns {Promise<V>}
     */
    async upgradeEach(vats) {
      /** @type {Record<string, Kept>} */
      const now = {};
      for (const [name, kept] of Object.entries(vats))
        now[name] = await upgrade(name, /** @type {Kept} */ (kept));
      return harden(/** @type {V} */ (now));
    },
  });
};
