/**
 * @file A review page's object: one snapshot of the book, reached through
 * its view. See {@link prepareReviewPage}.
 *
 * @import { Powers, Remote } from '@vattr/toybox/src/types.ts';
 * @import { View } from '../books.js';
 */

/** @typedef {{ view: Remote<View> }} Roots what the review's page calls: the book's view, not the books vat's root, which loads it, nor its admin node, which the boot vat keeps */

/** @param {Powers['M']} M */
export const makeReviewShapes = M => {
  const PageI = M.interface('ReviewPage', {
    summary: M.call().returns(M.promise()),
    uncategorized: M.call().returns(M.promise()),
  });
  return harden({ PageI });
};
/**
 * What a reviewer key designates: the book's uncategorized splits, through
 * its view.
 *
 * @typedef {ReturnType<ReturnType<typeof prepareReviewPage>>} ReviewPage
 */
/**
 * Review pages, a durable kind: `makeReviewPage(roots)` answers what a
 * reviewer key designates. A review is of one snapshot of the book: a git
 * tree of its sqlite-diffable dump, as `git ls-tree -r` lists it, which
 * the boot page loads. It holds the view only: making and upgrading the
 * vats is the boot vat's.
 *
 * @param {Powers['zone']} zone
 * @param {object} powers
 * @param {Powers['E']} powers.E
 * @param {Powers['M']} powers.M
 */
export const prepareReviewPage = (zone, { E, M }) => {
  const { PageI } = makeReviewShapes(M);
  const makeReviewPage = zone.exoClass(
    'ReviewPage',
    PageI,
    /** @param {Roots} roots */
    ({ view }) => ({ view }),
    {
      /** How many splits are uncategorized, and the dates of the first and last. */
      summary() {
        return E(this.state.view).summary();
      },
      /** The splits in uncategorized accounts, oldest first. */
      uncategorized() {
        return E(this.state.view).uncategorized();
      },
    },
  );
  return makeReviewPage;
};
