/**
 * @file Sealer/unsealer pattern for capability attenuation.
 * @see makeSealerUnsealerPair
 */

const { freeze } = Object;

/** An inert token representing a sealed value of type T (phantom type for branding). */
export type Sealed<T> = { readonly __sealed?: T };

export type Sealer<T = object> = { seal: (obj: T) => Sealed<T> };
export type Unsealer<T = object> = { unseal: (sealedObj: unknown) => T };

/**
 * Create a matched sealer/unsealer pair sharing a secret WeakMap.
 *
 * A sealer and unsealer work like public key cryptography conceptually.
 * You give something to the sealer and it puts that into a box (an inert token)
 * that only the corresponding unsealer can open.
 *
 * This enables sharing identification without sharing authority:
 * - The sealed token has no methods - it's just proof you know an unforgeable identity
 * - Only the matching unsealer can retrieve the original object
 *
 * @example
 * ```ts
 * const { sealer, unsealer } = makeSealerUnsealerPair<Purse>();
 *
 * // Seal a powerful object into an inert token
 * const token = sealer.seal(purse);  // token: Sealed<Purse>, no methods
 *
 * // Only the matching unsealer can retrieve the original
 * const original = unsealer.unseal(token);  // original: Purse
 * ```
 *
 * @see docs-dev/ocap-discipline.md for rationale
 */
export const makeSealerUnsealerPair = <T extends object = object>(): {
  sealer: Sealer<T>;
  unsealer: Unsealer<T>;
} => {
  const sealedToReal = new WeakMap<object, T>();
  const realToSealed = new WeakMap<T, Sealed<T>>();

  const sealer: Sealer<T> = freeze({
    seal: (obj: T): Sealed<T> => {
      if (realToSealed.has(obj)) return realToSealed.get(obj)!;
      const sealedObj = freeze({}) as Sealed<T>;
      sealedToReal.set(sealedObj, obj);
      realToSealed.set(obj, sealedObj);
      return sealedObj;
    },
  });

  const unsealer: Unsealer<T> = freeze({
    unseal: (sealedObj: unknown): T => {
      if (!sealedToReal.has(sealedObj as object)) {
        throw new Error("That's not my sealed object!");
      }
      return sealedToReal.get(sealedObj as object)!;
    },
  });

  return { sealer, unsealer };
};
