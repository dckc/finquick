/**
 * @file The app socket's `/api`: a webkey designates an object, and each
 * call is a method call on it. See {@link makeApi}.
 *
 * @import { HttpResponse, Powers, Remote } from '@vattr/toybox/src/types.ts';
 */

import { json } from './http.js';

/** An object, as `/api` calls it: by a method name from the request. @typedef {Record<string, (...args: any[]) => unknown>} Methods */

/**
 * The `/api` handler. Each call is `{ key, op, args }`: `op(...args)` on
 * the object `designates(key)` answers, whose interface guard refuses any
 * other method and any arguments it doesn't take; the result is the JSON
 * reply. A failure answers 400 with its message, and goes to workerd's
 * stderr (the journal), by op and message only: never the key or the args.
 *
 * @param {Powers['E']} E
 * @param {(key: unknown) => object | undefined | Promise<object | undefined>} designates
 * @returns {(body: string) => Promise<HttpResponse>}
 */
export const makeApi = (E, designates) => async body => {
  let request;
  try {
    request = JSON.parse(body);
  } catch {
    return json(400, { error: 'the body is JSON: { key, op, args }' });
  }
  const { key, op, args = [] } = request ?? {};
  try {
    const target = await designates(key);
    if (!target) return json(403, { error: 'that key opens nothing here' });
    if (typeof op !== 'string' || !Array.isArray(args))
      throw Error(
        'a call is { key, op, args }: a method name, and its arguments',
      );
    // by a name from the request: whichever its guard allows
    const methods = /** @type {Remote<Methods>} */ (target);
    return json(200, await E(methods)[op](...harden(args)));
  } catch (e) {
    const error = /** @type {Error} */ (e).message;
    console.warn(JSON.stringify({ event: 'books-api-failed', op, error }));
    return json(400, { error });
  }
};
