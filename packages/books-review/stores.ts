/** @file Types for the vats' stores: `put`, which sets a key either way, and `update`. */
import type { Key, MapStore } from '@vattr/toybox/src/types.ts';

/**
 * Set `key` to `value` in `store`: `init` the first time, `set` after. The
 * types are the store's, not inferred from `key` or `value`, so a wrong one
 * is refused rather than widening them.
 */
export type Put = <K extends Key, V>(
  store: MapStore<K, V>,
  key: NoInfer<K>,
  value: NoInfer<V>,
) => void;

/**
 * Set `key` in `store` to `f` of its value (`undefined` if it has none);
 * answers the new value. The types are the store's, as with {@link Put}.
 */
export type Update = <K extends Key, V>(
  store: MapStore<K, V>,
  key: NoInfer<K>,
  f: (value?: V) => NoInfer<V>,
) => V;
