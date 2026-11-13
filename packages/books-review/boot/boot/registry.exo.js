/**
 * @file Webkeys: unguessable keys, each designating an object, after E's
 * SwissTable. See {@link prepareRegistry}.
 *
 * @import { MapStore, Powers, Remote } from '@vattr/toybox/src/types.ts';
 * @import { Entropy } from '../../devices.ts';
 * @import { Webkey } from '../../types.ts';
 */

/**
 * Whether `x` could be a webkey: 32 hex digits, as the entropy device
 * answers them. A page sends its key as JSON, which says only that it's a
 * string.
 *
 * @param {unknown} x
 * @returns {x is Webkey}
 */
const isWebkey = x => typeof x === 'string' && /^[0-9a-f]{32}$/.test(x);

/**
 * The registry, durable: one. `register(x)` answers a webkey for `x`, the
 * same one each time; `deref(key)` answers what a key designates. Whoever
 * holds a key holds what it designates, so a key goes only in a link's
 * fragment, never in a log.
 *
 * @param {Powers['zone']} zone
 * @param {object} powers
 * @param {Powers['E']} powers.E
 * @param {Powers['M']} powers.M
 * @param {Remote<Entropy>} powers.entropy where keys come from
 * @see https://waterken.sourceforge.net/web-key/ Waterken's web-keys, which these follow
 */
export const prepareRegistry = (zone, { E, M, entropy }) => {
  /** @type {MapStore<Webkey, object>} */
  const byKey = zone.mapStore('webkeys');
  /** @type {MapStore<object, Webkey>} */
  const keyOf = zone.mapStore('webkey of');
  const RegistryI = M.interface('Registry', {
    register: M.call(M.remotable()).returns(M.promise()),
    deref: M.call(M.any()).returns(M.or(M.remotable(), M.undefined())),
  });
  return zone.exo('Registry', RegistryI, {
    /**
     * A webkey for `x`: the one it has, or a new one. `x` is a durable
     * object or one from another vat, which the registry can keep.
     *
     * @param {object} x
     * @returns {Promise<Webkey>}
     */
    async register(x) {
      if (keyOf.has(x)) return keyOf.get(x);
      const key = await E(entropy).swiss();
      // another register(x) may have finished while this one waited
      if (keyOf.has(x)) return keyOf.get(x);
      byKey.init(key, x);
      keyOf.init(x, key);
      return key;
    },
    /**
     * What `key` designates; `undefined` for anything else, a string that
     * isn't a webkey included.
     *
     * @param {unknown} key
     * @returns {object | undefined}
     */
    deref(key) {
      return isWebkey(key) && byKey.has(key) ? byKey.get(key) : undefined;
    },
  });
};
