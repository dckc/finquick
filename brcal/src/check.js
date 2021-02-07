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
