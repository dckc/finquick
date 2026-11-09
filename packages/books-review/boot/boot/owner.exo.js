/**
 * @file The owner: what the boot key designates, the boot page's part of
 * the boot vat. See {@link prepareOwner}.
 *
 * @import { Powers } from '@vattr/toybox/src/types.ts';
 * @import { TreeId, Webkey } from '../../types.ts';
 */

/** @typedef {{ tree: TreeId, dir: string, reviewerKey: Webkey }} Listed a review, as the boot page lists it */

/** @param {Powers['M']} M */
export const makeOwnerShapes = M => {
  const OwnerI = M.interface('Owner', {
    reviews: M.call().returns(M.promise()),
    load: M.call(M.string(), M.string()).returns(M.any()),
  });
  return harden({ OwnerI });
};
/** @typedef {ReturnType<ReturnType<typeof prepareOwner>>} Owner what the boot key designates */

/**
 * The owner, a durable kind, made once: it loads book snapshots, each a
 * review, and lists the reviews with their keys.
 *
 * @param {Powers['zone']} zone
 * @param {object} powers
 * @param {Powers['M']} powers.M
 * @param {() => Promise<Listed[]>} powers.reviews
 * @param {(listing: string, dir: string) => Promise<Listed>} powers.load
 */
export const prepareOwner = (zone, { M, reviews, load }) => {
  const { OwnerI } = makeOwnerShapes(M);
  const makeOwner = zone.exoClass('Owner', OwnerI, () => ({}), {
    /** Each review, with the key to its page. */
    reviews() {
      return reviews();
    },
    /**
     * Load the snapshot `listing` lists: what `git ls-tree -r <tree>`
     * prints, with or without -z; `dir` is where in the tree the dump is.
     *
     * @param {string} listing
     * @param {string} dir
     */
    load(listing, dir) {
      return load(listing, dir);
    },
  });
  return makeOwner;
};
