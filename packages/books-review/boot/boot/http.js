/**
 * @file Responses for the app socket, and the route from a request to one.
 * See {@link respond}.
 *
 * @import { HttpRequest, HttpResponse } from '@vattr/toybox/src/types.ts';
 */

/** @param {string} type @param {string} body @returns {HttpResponse} */
export const ok = (type, body) =>
  harden({ status: 200, headers: { 'content-type': type }, body });

/** @type {HttpResponse} */
const NOT_FOUND = harden({
  status: 404,
  headers: { 'content-type': 'text/plain' },
  body: 'not found\n',
});

/**
 * The app socket's handler: a GET of one of `files` answers it, and
 * anything else is not found.
 *
 * @param {object} site
 * @param {Record<string, HttpResponse>} site.files by path
 * @returns {(request: HttpRequest) => HttpResponse}
 */
export const respond =
  ({ files }) =>
  ({ method, path }) => {
    if (method === 'GET' && Object.hasOwn(files, path)) return files[path];
    return NOT_FOUND;
  };
