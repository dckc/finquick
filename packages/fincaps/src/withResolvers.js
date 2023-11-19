// @ts-check

/**
 * Promise constructor with resolvers
 *
 * ref https://github.com/tc39/proposal-promise-with-resolvers
 *
 * @template T
 * @returns promise along with its resolution and rejection functions exposed
 */
export const withResolvers = () => {
  /** @type {(resolution: T) => void} */
  let resolve;
  /** @type {(reason: unknown) => void} */
  let reject;
  /** @type {Promise<T>} */
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    // @ts-expect-error assigned above
    resolve,
    // @ts-expect-error assigned above
    reject,
  };
};

/** @template T @typedef {ReturnType<typeof withResolvers<T>>} PromiseKit<T> */
