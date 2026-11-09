/**
 * @file A review page's object: one snapshot of the book, reached through
 * its reviewer and categorizer. See {@link prepareReviewPage}.
 *
 * @import { Powers, Remote } from '@vattr/toybox/src/types.ts';
 * @import { ModelUser } from './owner.exo.js';
 * @import { Categorizer } from '../categorizer.js';
 * @import { Reviewer } from '../reviewer.js';
 */

/** @typedef {{ reviewer: Remote<Reviewer>, categorizer: Remote<Categorizer> }} Roots the roots of the review's vats that its page calls: not their admin nodes, which the boot vat keeps */

/** @param {Powers['M']} M */
export const makeReviewShapes = M => {
  const PageI = M.interface('ReviewPage', {
    pending: M.call().returns(M.promise()),
    summary: M.call().returns(M.promise()),
    categorize: M.call().optional(M.number()).returns(M.promise()),
  });
  return harden({ PageI });
};
/**
 * What a reviewer key designates: the reviewer's queries, but not its
 * proposal box, which is the categorizer's; and `categorize`.
 *
 * @typedef {ReturnType<ReturnType<typeof prepareReviewPage>>} ReviewPage
 */
/**
 * Review pages, a durable kind: `makeReviewPage(roots)` answers what a
 * reviewer key designates. A review is of one snapshot of the book: a git
 * tree of its sqlite-diffable dump, as `git ls-tree -r` lists it, which
 * the boot page loads. It holds the roots only: making and upgrading
 * the vats is the boot vat's.
 *
 * @param {Powers['zone']} zone
 * @param {object} powers
 * @param {Powers['E']} powers.E
 * @param {Powers['M']} powers.M
 * @param {ModelUser} powers.model the one the owner set up
 */
export const prepareReviewPage = (zone, { E, M, model }) => {
  const { PageI } = makeReviewShapes(M);
  const makeReviewPage = zone.exoClass(
    'ReviewPage',
    PageI,
    /** @param {Roots} roots */
    ({ reviewer, categorizer }) => ({ reviewer, categorizer }),
    {
      /** The proposals awaiting review, each with its support. */
      pending() {
        return E(this.state.reviewer).pending();
      },
      /** Where the review stands. */
      summary() {
        return E(this.state.reviewer).summary();
      },
      /** Ask the model for up to `limit` proposals. @param {number} [limit] */
      async categorize(limit = 10) {
        const { webApp, name } = model.get();
        return E(this.state.categorizer).categorize(limit || 10, webApp, name);
      },
    },
  );
  return makeReviewPage;
};
