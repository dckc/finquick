// @ts-check

export const check = {
  /**
   * @param {T | null | undefined } x
   * @param { string= } context
   * @returns { T }
   * @template T
   */
  notNull(x, context) {
    if (!x) {
      throw new Error(`null/undefined ${context}`);
    }
    return x;
  },
};

/**
 * @param {string} label
 * @returns {(val: T) => T}
 * @template T
 */
export function logged(label) {
  return function inspect(v) {
    console.log(label, v);
    return v;
  };
}
