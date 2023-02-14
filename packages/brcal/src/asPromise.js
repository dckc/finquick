// @ts-check

/**
 * Adapt callback-style API using Promises.
 *
 * Instead of obj.method(...arg, callback),
 * use send(cb => obj.method(...arg, cb)) and get a promise.
 *
 * @param {(cb: (err: E, result: T) => void) => void} calling
 * @returns { Promise<T> }
 * @template T
 * @template E
 */
export function asPromise(calling) {
  function executor(
    /** @type {(it: T) => void} */ resolve,
    /** @type {(err: any) => void} */ reject
  ) {
    const callback = (/** @type { E } */ err, /** @type {T} */ result) => {
      if (err) {
        reject(err);
      }
      resolve(result);
    };

    calling(callback);
  }

  return new Promise(executor);
}
