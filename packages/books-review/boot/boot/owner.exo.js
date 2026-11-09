/**
 * @file The owner: what the boot key designates, the boot page's part of
 * the boot vat, and the model it sets up. See {@link prepareOwner}.
 *
 * @import { MapStore, Powers, Remote } from '@vattr/toybox/src/types.ts';
 * @import { WebApp, WebApps } from '../../devices.ts';
 * @import { Put } from '../../stores.ts';
 * @import { TreeId, Webkey } from '../../types.ts';
 */

/** @typedef {{ tree: TreeId, dir: string, reviewerKey: Webkey }} Listed a review, as the boot page lists it */
/** @typedef {`http${'' | 's'}://${string}`} HttpUrl */
/** @typedef {{ url: HttpUrl, name: string, webApp: Remote<WebApp> }} Model the model the boot page set up, and a WebApp narrowed to its API */
/** @typedef {MapStore<'authorization', `Bearer ${string}`>} Headers the model API's headers: its key */

/** @type {Put} */
const put = (store, key, value) =>
  store.has(key) ? store.set(key, value) : store.init(key, value);

/** @param {string} url @returns {url is HttpUrl} */
const isHttpUrl = url => /^https?:$/.test(new URL(url).protocol);

/** @param {Powers['M']} M */
export const makeOwnerShapes = M => {
  const OwnerI = M.interface('Owner', {
    reviews: M.call().returns(M.promise()),
    load: M.call(M.string(), M.string()).returns(M.any()),
    model: M.call().returns(M.record()),
    setModel: M.call(M.string(), M.string())
      .optional(M.string())
      .returns(M.promise()),
  });
  const ModelI = M.interface('Model', {
    get: M.call().returns(M.record()),
  });
  return harden({ OwnerI, ModelI });
};
/** @typedef {ReturnType<ReturnType<typeof prepareOwner>>} OwnerKit */
/** @typedef {OwnerKit['owner']} Owner what the boot key designates */
/**
 * The model, for whoever asks it for proposals: to send with, but not to
 * change, nor to read the key from.
 *
 * @typedef {OwnerKit['model']} ModelUser
 */

/**
 * The owner, a durable kind of kit, made once: `owner` loads book
 * snapshots, each a review, lists the reviews with their keys, and sets up
 * the model; `model` answers the model, once set up, for the review pages.
 *
 * The model is reached through a WebApp of the WebApp vat's, whose egress
 * is the LAN device, narrowed to the model's API URL, and sending the API
 * key from a header map that only the owner writes: the WebApp gets the
 * map's read-only facet, so whoever sends with it sends the key but can't
 * read it.
 *
 * @param {Powers['zone']} zone
 * @param {object} powers
 * @param {Powers['E']} powers.E
 * @param {Powers['M']} powers.M
 * @param {() => Promise<Listed[]>} powers.reviews
 * @param {(listing: string, dir: string) => Promise<Listed>} powers.load
 * @param {() => Promise<Remote<WebApps>>} powers.webApps the WebApp vat's root
 */
export const prepareOwner = (zone, { E, M, reviews, load, webApps }) => {
  const { OwnerI, ModelI } = makeOwnerShapes(M);
  const makeOwner = zone.exoClassKit(
    'Owner',
    { owner: OwnerI, model: ModelI },
    () => ({
      /** @type {Model | null} */
      model: null,
      /** @type {Headers} */
      headers: zone.detached().mapStore('model headers'),
    }),
    {
      owner: {
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
        /** The model's API base URL and name, once set up. */
        model() {
          const { model } = this.state;
          return harden(model ? { url: model.url, name: model.name } : {});
        },
        /**
         * Set the model's API base URL and name, and its API key if given;
         * else the key stays as it was.
         *
         * @param {string} url
         * @param {string} name
         * @param {string} [apiKey]
         */
        async setModel(url, name, apiKey = undefined) {
          if (!isHttpUrl(url)) throw Error("the model's API is http or https");
          const { headers } = this.state;
          /** @type {Remote<WebApp>} */
          // awaited: the kernel carries references, not promises
          const webApp = await E(
            E(await webApps()).makeWebApp(url, {
              'content-type': 'application/json',
            }),
          ).withHeaderMap(headers.readOnly());
          this.state.model = harden({ url, name, webApp });
          if (apiKey !== undefined)
            put(headers, 'authorization', `Bearer ${apiKey}`);
        },
      },
      model: {
        /** The model's WebApp and name. */
        get() {
          const { model } = this.state;
          if (!model) throw Error('no model is set up yet');
          return harden({ webApp: model.webApp, name: model.name });
        },
      },
    },
  );
  return makeOwner;
};
