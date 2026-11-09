/**
 * @file The boot vat: it makes the vats that categorize a book, and serves
 * their pages on the app socket. See {@link buildRootObject}.
 *
 * @import { BuildRootObject, MapStore, Powers, Remote } from '@vattr/toybox/src/types.ts';
 * @import { BootBundles, Code, Entropy, FetchDevice, GitTrees, Ingress, ParamsOf, RootOf, VatAdmin, WebApps } from '../../devices.ts';
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
 * @property {typeof import('../reviewer.js').buildRootObject} reviewer
 * @property {typeof import('../categorizer.js').buildRootObject} categorizer
 * @property {(powers: Powers, params: { egress: Remote<FetchDevice> }) => WebApps} webApps the toybox's, which types its root only as `object`
 */

/** Each vat's code, by role: a file in the boot directory, and what it builds. */
const CODE = /** @type {{ [R in keyof Builders]: Code<Builders[R]> }} */ (
  harden({
    books: 'books.js',
    reviewer: 'reviewer.js',
    categorizer: 'categorizer.js',
    webApps: 'webapp.js',
  })
);

/** @typedef {'webApps'} SharedRole */
/** @typedef {{ [R in SharedRole]: Kept<RootOf<(typeof CODE)[R]>> | null }} SharedVats `null` until first asked for */
/** @typedef {Partial<{ [R in 'books' | 'reviewer' | 'categorizer']: Kept<RootOf<(typeof CODE)[R]>> }>} KeptReview one review's vats, filled in as they're made */
/** @template {keyof typeof CODE} R @typedef {ParamsOf<(typeof CODE)[R]>} ParamsFor */
/** @template {keyof typeof CODE} R @typedef {Remote<RootOf<(typeof CODE)[R]>>} RootFor */
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
 * @property {Remote<FetchDevice>} lan the agent's egress
 */

/** @typedef {ReturnType<typeof makeUpgrader<typeof CODE>>} Upgrader */

/**
 * The vats reviews are made of, a durable kind, made once. Each review has
 * its own:
 * - books vat, which reads only the snapshot's tree;
 * - reviewer, which holds the proposals;
 * - categorizer, which reads the book, and has the agent propose; it sends
 *   to the agent's API, but can't read the key.
 *
 * The reviews share one WebApp maker, through which the agent is reached,
 * and which reaches only the LAN.
 *
 * It holds what can upgrade or restart a vat, the upgrader and each vat's
 * admin node, and hands out only roots. A shared vat is made the first
 * time it's asked for; a review's are kept under its tree.
 *
 * @param {Powers['zone']} zone
 * @param {object} powers
 * @param {Powers['M']} powers.M
 * @param {Upgrader} powers.upgrader
 * @param {{ [R in SharedRole]: ParamsFor<R> }} powers.shared
 */
const prepareReviewVats = (zone, { M, upgrader, shared }) => {
  /** @type {Map<SharedRole, Promise<unknown>>} in the making */
  const sharing = new Map();
  /**
   * The root of `role`'s vat, made the first time; a second ask meanwhile
   * waits for the first.
   *
   * @template {SharedRole} R
   * @param {SharedVats} state
   * @param {R} role
   * @returns {Promise<RootFor<R>>}
   */
  const provideShared = async (state, role) => {
    const kept = state[role];
    if (kept) return kept.root;
    let made = sharing.get(role);
    if (!made) {
      made = upgrader
        .create(role, shared[role])
        .then(k => {
          // each role's field holds that role's vat
          /** @type {Record<R, unknown>} */ (state)[role] = k;
          return k;
        })
        .finally(() => sharing.delete(role));
      sharing.set(role, made);
    }
    return /** @type {Kept<RootOf<(typeof CODE)[R]>>} */ (await made).root;
  };

  return zone.exoClass(
    'ReviewVats',
    M.interface('ReviewVats', {
      webApps: M.call().returns(M.promise()),
      createBooks: M.call(M.string(), M.record()).returns(M.promise()),
      createReviewer: M.call(M.string(), M.record()).returns(M.promise()),
      createCategorizer: M.call(M.string(), M.record()).returns(M.promise()),
      upgrade: M.call().returns(M.promise()),
      of: M.call(M.string()).returns(M.record()),
    }),
    /** @returns {SharedVats & { reviews: MapStore<TreeId, KeptReview> }} */
    () => ({
      webApps: null,
      reviews: zone.detached().mapStore('review vats'),
    }),
    {
      webApps() {
        return provideShared(this.state, 'webApps');
      },
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
      /** @param {TreeId} tree @param {ParamsFor<'reviewer'>} params */
      async createReviewer(tree, params) {
        const reviewer = await upgrader.create('reviewer', params);
        const { reviews } = this.state;
        reviews.set(tree, harden({ ...reviews.get(tree), reviewer }));
        return reviewer.root;
      },
      /** @param {TreeId} tree @param {ParamsFor<'categorizer'>} params */
      async createCategorizer(tree, params) {
        const categorizer = await upgrader.create('categorizer', params);
        const { reviews } = this.state;
        reviews.set(tree, harden({ ...reviews.get(tree), categorizer }));
        return categorizer.root;
      },
      /** Each vat whose code in the boot directory changed, upgraded. */
      async upgrade() {
        const { state } = this;
        if (state.webApps)
          state.webApps = await upgrader.upgrade('webApps', state.webApps);
        for (const [tree, kept] of state.reviews.entries())
          state.reviews.set(tree, await upgrader.upgradeEach(kept));
      },
      /** A review's vats, admin nodes and all: for the tests. @param {TreeId} tree */
      of(tree) {
        return this.state.reviews.get(tree);
      },
    },
  );
};

/**
 * The boot vat: it makes the vats in which an agent proposes where a
 * book's uncategorized splits go, and serves their pages through its
 * ingress. It holds the vatAdmin and every device, and gives each part
 * only what it needs.
 *
 * Who can do what, by the key or reference they hold:
 * - the root, which the kernel and the serve script hold: start the vats,
 *   upgrading each whose code changed, and get the owner's link (and, for
 *   the tests, see each review's vats);
 * - the owner, by the boot key: load a snapshot of the book, set up the
 *   agent (its chat API's URL, the model's name there, and the key), and
 *   get each review's key; not read the API key back;
 * - a reviewer, by one review's key: read its proposals, and ask the agent
 *   for more; not propose, nor reach another review.
 *
 * @see prepareReviewPage for what a review is
 * @see prepareReviewVats for the vats a review is made of
 * @type {BuildRootObject<Params>}
 */
export const buildRootObject = (
  { E, Far, M, zone },
  { vatAdmin, bundles, entropy, ingress, gitTrees, lan },
) => {
  const registry = prepareRegistry(zone, { E, M, entropy });
  /** @type {MapStore<TreeId, Review>} */
  const reviews = zone.mapStore('reviews');
  const upgrader = makeUpgrader(E, { vatAdmin, bundles }, CODE);

  /** @type {{ [R in SharedRole]: ParamsFor<R> }} */
  const SHARED = harden({
    webApps: { egress: lan },
  });
  const makeVats = prepareReviewVats(zone, { M, upgrader, shared: SHARED });
  const vats = zone.makeOnce('vats', () => makeVats());

  const makeOwner = prepareOwner(zone, {
    E,
    M,
    reviews: () => Promise.all(reviews.values().map(listed)),
    load: async (listing, dir) => listed(await provideReview(listing, dir)),
    webApps: () => vats.webApps(),
  });
  const { owner, model } = zone.makeOnce('owner', () => makeOwner());
  const makeReviewPage = prepareReviewPage(zone, { E, M, model });

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
    const reviewer = await vats.createReviewer(tree, { view });
    const categorizer = await vats.createCategorizer(tree, {
      view,
      box: await E(reviewer).getProposalBox(),
    });
    const page = makeReviewPage({ reviewer, categorizer });
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
    /** The boot page's link fragment: whoever opens it can load snapshots and set up the agent. */
    ownerLink: async () => `#${await registry.register(owner)}`,
  });
};
