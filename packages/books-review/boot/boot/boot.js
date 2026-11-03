/**
 * Boots the vats that categorize a book, after SwingSet's bootstrap vat.
 * `makeBooks(listing, dir)` takes what `git ls-tree -r` lists for a
 * snapshot of the book's sqlite-diffable dump and makes a books vat for
 * that tree, then a reviewer and a categorizer for it; the same tree again
 * answers the same vats. Each gets only what its part needs: the reviewer,
 * the book's view and mover and the lessons' recorder; the categorizer, the
 * view, the reviewer's proposal box, and the lessons' reader. One lessons
 * vat serves every book, so what a person teaches carries over to the next
 * snapshot.
 *
 * It serves a web UI on the app socket: a page to load a snapshot by
 * pasting a listing and to set up the model, and a page per book to ask
 * the model for proposals and review them. The boot key opens the first;
 * each book's reviewer key, only its own review page.
 *
 * The model is reached through a WebApp vat whose egress is the LAN
 * device, narrowed to the model's API URL, with the API key in a header
 * map only this vat writes.
 */
import { BOOT_PAGE, BOOT_SCRIPT, REVIEW_PAGE, REVIEW_SCRIPT } from './pages.js';

/**
 * @import { BuildRootObject, HttpRequest, HttpResponse, MapStore, Remote } from '@vattr/toybox/types.ts';
 */

/** @typedef {{ root: Remote, adminNode: Remote, bundle: Remote }} Kept */
/** @typedef {'books' | 'reviewer' | 'categorizer'} Role */
/**
 * @typedef {object} Instance one book snapshot's vats
 * @property {string} tree
 * @property {string} dir
 * @property {Record<Role, Kept>} vats
 * @property {string} reviewerKey
 */

/** Each vat's code, by role: a name in the boot directory. */
const CODE = harden({
  books: 'books.js',
  reviewer: 'reviewer.js',
  categorizer: 'categorizer.js',
  lessons: 'lessons.js',
  webApps: 'webapp.js',
});

/** @param {string} body @returns {HttpResponse} */
const page = body => ({
  status: 200,
  headers: { 'content-type': 'text/html; charset=utf-8' },
  body,
});
/** @param {string} body @returns {HttpResponse} */
const script = body => ({
  status: 200,
  headers: { 'content-type': 'text/javascript; charset=utf-8' },
  body,
});
/** @param {number} status @param {unknown} value @returns {HttpResponse} */
const json = (status, value) => ({
  status,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(value ?? null),
});

/**
 * @typedef {object} Params what the kernel gives a boot vat
 * @property {Remote} vatAdmin
 * @property {Remote} bundles the boot directory's
 * @property {Remote} entropy
 * @property {Remote} ingress the app socket's
 * @property {Remote} gitWorktree where snapshots of the book are read
 * @property {Remote} lan the model's egress
 */

/** @type {BuildRootObject<Params>} */
export const buildRootObject = (
  { E, Far, zone },
  { vatAdmin, bundles, entropy, ingress, gitWorktree, lan },
) => {
  /** @type {MapStore<string, any>} the boot key, the shared vats, the model's settings */
  const boot = zone.mapStore('boot');
  /** @type {MapStore<string, Instance>} by tree id */
  const instances = zone.mapStore('instances');
  /** @type {MapStore<string, string>} reviewer key → tree id */
  const reviewerKeys = zone.mapStore('reviewerKeys');
  /** @type {MapStore<string, string>} the model API's headers: its key */
  const modelHeaders = zone.makeOnce('modelHeaders', () =>
    zone.detached().mapStore('model headers'),
  );

  /** @param {keyof typeof CODE} role */
  const bundleOf = role => E(bundles).getBundleCap(CODE[role]);

  /**
   * A shared vat, made the first time, and upgraded when its code in the
   * boot directory changed.
   *
   * @param {'lessons' | 'webApps'} role
   * @param {object} params for a new vat
   * @returns {Promise<Remote>} its root
   */
  const shared = async (role, params) => {
    const bundle = await bundleOf(role);
    if (!boot.has(role)) {
      const { root, adminNode } = await E(vatAdmin).createVat(bundle, params);
      boot.init(role, harden({ root, adminNode, bundle }));
      return root;
    }
    /** @type {Kept} */
    const kept = boot.get(role);
    // the same code gives the same bundleCap, so the same presence
    if (kept.bundle !== bundle) {
      await E(kept.adminNode).upgrade(bundle);
      boot.set(role, harden({ ...kept, bundle }));
    }
    return kept.root;
  };

  /** @param {Record<Role, Kept>} vats @returns {Promise<Record<Role, Kept>>} */
  const upgraded = async vats => {
    /** @type {Record<string, Kept>} */
    const now = {};
    for (const [role, kept] of Object.entries(vats)) {
      const bundle = await bundleOf(/** @type {Role} */ (role));
      if (kept.bundle !== bundle) await E(kept.adminNode).upgrade(bundle);
      now[role] = harden({ ...kept, bundle });
    }
    return harden(/** @type {Record<Role, Kept>} */ (now));
  };

  /**
   * @param {string} tree
   * @param {string} listing
   * @param {string} dir
   * @returns {Promise<Instance>}
   */
  const make = async (tree, listing, dir) => {
    const lessons = await shared('lessons', {});
    const snapshot = await E(gitWorktree).getTree(tree, listing);
    /** @param {Role} role @param {object} params @returns {Promise<Kept>} */
    const vat = async (role, params) => {
      const bundle = await bundleOf(role);
      const { root, adminNode } = await E(vatAdmin).createVat(bundle, params);
      return harden({ root, adminNode, bundle });
    };
    const books = await vat('books', { tree: snapshot });
    await E(books.root).load(dir);
    const [view, mover, recorder, reader] = await Promise.all([
      E(books.root).getView(),
      E(books.root).getMover(),
      E(lessons).getRecorder(),
      E(lessons).getReader(),
    ]);
    const reviewer = await vat('reviewer', {
      view,
      mover,
      lessons: recorder,
      book: tree,
    });
    const categorizer = await vat('categorizer', {
      view,
      box: await E(reviewer.root).getProposalBox(),
      lessons: reader,
    });
    /** @type {Instance} */
    const instance = harden({
      tree,
      dir,
      vats: { books, reviewer, categorizer },
      reviewerKey: await E(entropy).swiss(),
    });
    instances.init(tree, instance);
    reviewerKeys.init(instance.reviewerKey, tree);
    return instance;
  };

  /** Makes in progress, by tree id, so a second ask waits for the first. @type {Map<string, Promise<Instance>>} */
  const making = new Map();

  /**
   * The vats for the snapshot `listing` lists, made the first time.
   *
   * @param {string} listing what `git ls-tree -r <tree>` lists, with or without -z
   * @param {string} dir where in the tree the dump is
   */
  const makeBooks = async (listing, dir) => {
    if (typeof dir !== 'string' || !dir)
      throw Error('which directory of the tree is the dump in?');
    /** @type {string} */
    const tree = await E(E(gitWorktree).getTree(null, listing)).id();
    if (instances.has(tree)) return instances.get(tree);
    let made = making.get(tree);
    if (!made) {
      made = make(tree, listing, dir).finally(() => making.delete(tree));
      making.set(tree, made);
    }
    return made;
  };

  /** The model, through a WebApp narrowed to its API, as set on the boot page. */
  const model = async () => {
    if (!boot.has('model')) throw Error('no model is set up yet');
    /** @type {{ url: string, name: string }} */
    const { url, name } = boot.get('model');
    const webApps = await shared('webApps', { egress: lan });
    // awaited: the kernel carries references, not promises
    const webApp = await E(
      E(webApps).makeWebApp(url, { 'content-type': 'application/json' }),
    ).withHeaderMap(modelHeaders.readOnly());
    return { webApp, name };
  };

  /** @param {Instance} i */
  const summary = ({ tree, dir, reviewerKey }) => ({ tree, dir, reviewerKey });

  /** @param {Record<string, any>} request */
  const bootApi = async request => {
    switch (request.op) {
      case 'instances':
        return instances.values().map(summary);
      case 'makeBooks':
        return summary(await makeBooks(request.listing, request.dir));
      case 'model':
        return boot.has('model') ? boot.get('model') : {};
      case 'setModel': {
        const { url, name, apiKey } = request;
        if (typeof url !== 'string' || typeof name !== 'string')
          throw Error('a model has a url and a name');
        new URL(url);
        const settings = harden({ url, name });
        if (boot.has('model')) boot.set('model', settings);
        else boot.init('model', settings);
        if (typeof apiKey === 'string') {
          const header = `Bearer ${apiKey}`;
          if (modelHeaders.has('authorization'))
            modelHeaders.set('authorization', header);
          else modelHeaders.init('authorization', header);
        }
        return null;
      }
      default:
        throw Error(`the boot key has no ${JSON.stringify(request.op)}`);
    }
  };

  /** @param {Instance} instance @param {Record<string, any>} request */
  const reviewApi = async ({ vats }, request) => {
    const reviewer = vats.reviewer.root;
    switch (request.op) {
      case 'accounts':
        return E(reviewer).accounts();
      case 'pending':
        return E(reviewer).pending();
      case 'review':
        return E(reviewer).review(
          request.n,
          request.verdict,
          typeof request.note === 'string' ? request.note : undefined,
        );
      case 'changelog':
        return E(reviewer).changelog();
      case 'categorize': {
        const { webApp, name } = await model();
        return E(vats.categorizer.root).categorize(
          Number(request.limit) || 10,
          webApp,
          name,
        );
      }
      default:
        throw Error(`a reviewer key has no ${JSON.stringify(request.op)}`);
    }
  };

  /** One `/api` call: `{ key, op, ...args }`. @param {string} body */
  const api = async body => {
    let request;
    try {
      request = JSON.parse(body);
    } catch {
      return json(400, { error: 'the body is JSON: { key, op, ... }' });
    }
    const { key } = request ?? {};
    try {
      if (key === boot.get('key')) return json(200, await bootApi(request));
      if (typeof key === 'string' && reviewerKeys.has(key))
        return json(
          200,
          await reviewApi(instances.get(reviewerKeys.get(key)), request),
        );
      return json(403, { error: 'that key opens nothing here' });
    } catch (e) {
      const error = /** @type {Error} */ (e).message;
      // to workerd's stderr, so the journal says why; never the key or args
      console.warn(
        JSON.stringify({ event: 'books-api-failed', op: request.op, error }),
      );
      return json(400, { error });
    }
  };

  const makeWeb = zone.exoClass('Web', undefined, () => ({}), {
    /** @param {HttpRequest} request @returns {Promise<HttpResponse> | HttpResponse} */
    handle({ method, path, body }) {
      if (method === 'GET' && path === '/') return page(BOOT_PAGE);
      if (method === 'GET' && path === '/boot.js') return script(BOOT_SCRIPT);
      if (method === 'GET' && path === '/review') return page(REVIEW_PAGE);
      if (method === 'GET' && path === '/review.js')
        return script(REVIEW_SCRIPT);
      if (method === 'POST' && path === '/api') return api(body);
      return {
        status: 404,
        headers: { 'content-type': 'text/plain' },
        body: 'not found\n',
      };
    },
  });
  zone.makeOnce('web', () => {
    const web = makeWeb();
    E(ingress).serve(web);
    return web;
  });

  return Far('booksBoot', {
    /** On each start of the kernel: the boot key, and the vats upgraded to the code in the boot directory. */
    async start() {
      if (!boot.has('key')) boot.init('key', await E(entropy).swiss());
      await shared('lessons', {});
      if (boot.has('webApps')) await shared('webApps', { egress: lan });
      for (const instance of instances.values())
        instances.set(
          instance.tree,
          harden({ ...instance, vats: await upgraded(instance.vats) }),
        );
    },
    makeBooks,
    /** Each book's vats, by tree id. */
    instances: () => harden(instances.values()),
    /** The boot page's link fragment: whoever opens it can load snapshots and set up the model. */
    ownerLink: () => `#${boot.get('key')}`,
  });
};
