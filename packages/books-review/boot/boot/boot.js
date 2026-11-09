/**
 * @file The boot vat: it makes a vat for each snapshot of a book, and
 * serves pages about them on the app socket. See {@link buildRootObject}.
 *
 * @import { BuildRootObject, MapStore, Powers, Remote } from '@vattr/toybox/src/types.ts';
 * @import { BootBundles, Code, Entropy, GitTrees, Ingress, ParamsOf, RootOf, VatAdmin } from '../../devices.ts';
 * @import { TreeId } from '../../types.ts';
 * @import { ReviewPage } from './review.exo.js';
 * @import { Kept } from './upgrade.js';
 */
import { makeApi } from './api.js';
import { respond } from './http.js';
import { prepareOwner } from './owner.exo.js';
import { prepareRegistry } from './registry.exo.js';
import { prepareReviewPage } from './review.exo.js';
import { FILES } from './site.js';
import { makeUpgrader } from './upgrade.js';
import { prepareWeb } from './web.exo.js';

/**
 * @typedef {object} Builders each vat's `buildRootObject`, by role
 * @property {typeof import('../books.js').buildRootObject} books
 */

/** Each vat's code, by role: a file in the boot directory, and what it builds. */
const CODE = /** @type {{ [R in keyof Builders]: Code<Builders[R]> }} */ (
  harden({
    books: 'books.js',
  })
);

/** @typedef {{ books: Kept<RootOf<(typeof CODE)['books']>> }} KeptReview one review's vats */
/** @template {keyof typeof CODE} R @typedef {ParamsOf<(typeof CODE)[R]>} ParamsFor */
/**
 * @typedef {object} Review
 * @property {TreeId} tree
 * @property {string} dir where in the tree the book's dump is
 * @property {ReviewPage} page what its reviewer key designates
 */

/**
 * @typedef {object} Params what the kernel gives a boot vat
 * @property {Remote<VatAdmin>} vatAdmin
 * @property {Remote<BootBundles>} bundles the boot directory's
 * @property {Remote<Entropy>} entropy
 * @property {Remote<Ingress>} ingress the app socket's
 * @property {Remote<GitTrees>} gitTrees where snapshots of the book are read
 */

/** @typedef {ReturnType<typeof makeUpgrader<typeof CODE>>} Upgrader */

/**
 * The vats reviews are made of, a durable kind, made once: each review's
 * books vat, which reads only the snapshot's tree.
 *
 * It holds what can upgrade or restart a vat, the upgrader and each vat's
 * admin node, and hands out only roots. A review's vats are kept under its
 * tree.
 *
 * @param {Powers['zone']} zone
 * @param {object} powers
 * @param {Powers['M']} powers.M
 * @param {Upgrader} powers.upgrader
 */
const prepareReviewVats = (zone, { M, upgrader }) =>
  zone.exoClass(
    'ReviewVats',
    M.interface('ReviewVats', {
      createBooks: M.call(M.string(), M.record()).returns(M.promise()),
      upgrade: M.call().returns(M.promise()),
      of: M.call(M.string()).returns(M.record()),
    }),
    /** @returns {{ reviews: MapStore<TreeId, KeptReview> }} */
    () => ({
      reviews: zone.detached().mapStore('review vats'),
    }),
    {
      /**
       * A review's books vat, which starts its record afresh: a make of the
       * same review that failed may have left one.
       *
       * TODO(terminate): the vats a failed make left are kept by no one,
       * but still run; the vatAdmin has no way to end them.
       *
       * @param {TreeId} tree
       * @param {ParamsFor<'books'>} params
       */
      async createBooks(tree, params) {
        const books = await upgrader.create('books', params);
        const { reviews } = this.state;
        const kept = harden({ books });
        if (reviews.has(tree)) reviews.set(tree, kept);
        else reviews.init(tree, kept);
        return books.root;
      },
      /** Each vat whose code in the boot directory changed, upgraded. */
      async upgrade() {
        const { state } = this;
        for (const [tree, kept] of state.reviews.entries())
          state.reviews.set(tree, await upgrader.upgradeEach(kept));
      },
      /** A review's vats, admin nodes and all: for the tests. @param {TreeId} tree */
      of(tree) {
        return this.state.reviews.get(tree);
      },
    },
  );

/**
 * The boot vat: it makes a vat for each snapshot of a book, which reads
 * it, and serves a page about each through its ingress. It holds the
 * vatAdmin and every device, and gives each part only what it needs.
 *
 * Who can do what, by the key or reference they hold:
 * - the root, which the kernel and the serve script hold: start the vats,
 *   upgrading each whose code changed, and get the owner's link (and, for
 *   the tests, see each review's vats);
 * - the owner, by the boot key: load a snapshot of the book, and get each
 *   review's key;
 * - a reviewer, by one review's key: read the book's uncategorized splits;
 *   not reach another review.
 *
 * @see prepareReviewPage for what a review is
 * @see prepareReviewVats for the vats a review is made of
 * @type {BuildRootObject<Params>}
 */
export const buildRootObject = (
  { E, Far, M, zone },
  { vatAdmin, bundles, entropy, ingress, gitTrees },
) => {
  const registry = prepareRegistry(zone, { E, M, entropy });
  /** @type {MapStore<TreeId, Review>} */
  const reviews = zone.mapStore('reviews');
  const upgrader = makeUpgrader(E, { vatAdmin, bundles }, CODE);

  const makeVats = prepareReviewVats(zone, { M, upgrader });
  const vats = zone.makeOnce('vats', () => makeVats());

  const makeOwner = prepareOwner(zone, {
    M,
    reviews: () => Promise.all(reviews.values().map(listed)),
    load: async (listing, dir) => listed(await provideReview(listing, dir)),
  });
  const owner = zone.makeOnce('owner', () => makeOwner());
  const makeReviewPage = prepareReviewPage(zone, { E, M });

  /**
   * A new review of `tree`: its vats, and its page.
   *
   * @param {TreeId} tree
   * @param {string} listing
   * @param {string} dir
   * @returns {Promise<Review>}
   */
  const makeReview = async (tree, listing, dir) => {
    const snapshot = await E(gitTrees).getTree(tree, listing);
    const books = await vats.createBooks(tree, { tree: snapshot });
    await E(books).load(dir);
    const view = await E(books).getView();
    const page = makeReviewPage({ view });
    const review = harden({ tree, dir, page });
    reviews.init(tree, review);
    return review;
  };

  /** Makes in progress, by tree id, so a second ask waits for the first. @type {Map<TreeId, Promise<Review>>} */
  const making = new Map();

  /**
   * The review of the snapshot `listing` lists, made the first time.
   *
   * @param {string} listing what `git ls-tree -r <tree>` lists, with or without -z
   * @param {string} dir where in the tree the dump is
   * @returns {Promise<Review>}
   */
  const provideReview = async (listing, dir) => {
    if (typeof dir !== 'string' || !dir)
      throw Error('which directory of the tree is the dump in?');
    const tree = await E(E(gitTrees).getTree(null, listing)).id();
    if (reviews.has(tree)) return reviews.get(tree);
    let made = making.get(tree);
    if (!made) {
      made = makeReview(tree, listing, dir).finally(() => making.delete(tree));
      making.set(tree, made);
    }
    return made;
  };

  /** A review as the boot page lists it, with the key to its page. @param {Review} review */
  const listed = async ({ tree, dir, page }) => ({
    tree,
    dir,
    reviewerKey: await registry.register(page),
  });

  const makeWeb = prepareWeb(
    zone,
    respond({ files: FILES, api: makeApi(E, key => registry.deref(key)) }),
  );
  zone.makeOnce('web', () => {
    const web = makeWeb();
    E(ingress).serve(web);
    return web;
  });

  return Far('booksBoot', {
    /** On each start of the kernel: the vats upgraded to the code in the boot directory. */
    async start() {
      await vats.upgrade();
    },
    /** Each review: its tree, its dump's directory, and its vats. */
    reviews: () =>
      harden(
        reviews.values().map(({ tree, dir }) => ({
          tree,
          dir,
          vats: vats.of(tree),
        })),
      ),
    /** The boot page's link fragment: whoever opens it can load snapshots. */
    ownerLink: async () => `#${await registry.register(owner)}`,
  });
};
