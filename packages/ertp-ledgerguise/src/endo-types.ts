export type Key = unknown;
export type Pattern = unknown;
export const PASS_STYLE = /** @type {'Symbol(passStyle)'} */ (
  /** @type {unknown} */ (Symbol.for('passStyle'))
);
export type RemotableObject = {
  [PASS_STYLE]?: string;
  [Symbol.toStringTag]?: string;
  [key: string]: unknown;
  [key: symbol]: unknown;
};
export type ERef<T> = T | PromiseLike<T>;
export type LatestTopic<T> = unknown;
export type CopySet<T = unknown> = Readonly<Set<T>>;
export type CopyBag<T = unknown> = Readonly<Map<T, bigint>>;
