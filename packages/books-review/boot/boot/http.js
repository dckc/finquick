/**
 * @file Responses for the app socket, and the route from a request to one.
 * See {@link respond}.
 *
 * @import { HttpRequest, HttpResponse } from '@vattr/toybox/src/types.ts';
 */

/** @param {string} type @param {string} body @returns {HttpResponse} */
export const ok = (type, body) =>
  harden({ status: 200, headers: { 'content-type': type }, body });

/** @param {string} location @returns {HttpResponse} */
export const redirect = location =>
  harden({ status: 308, headers: { location } });

/** @param {number} status @param {unknown} value @returns {HttpResponse} */
export const json = (status, value) =>
  harden({
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value ?? null),
  });

/** @type {HttpResponse} */
const NOT_FOUND = harden({
  status: 404,
  headers: { 'content-type': 'text/plain' },
  body: 'not found\n',
});

/**
 * The app socket's handler: a GET of one of `files` answers it, a POST to
 * `/api` goes to `api`, and anything else is not found.
 *
 * @param {object} site
 * @param {Record<string, HttpResponse>} site.files by path
 * @param {(body: string) => Promise<HttpResponse>} site.api
 * @returns {(request: HttpRequest) => HttpResponse | Promise<HttpResponse>}
 */
export const respond =
  ({ files, api }) =>
  ({ method, path, body }) => {
    if (method === 'GET' && Object.hasOwn(files, path)) return files[path];
    if (method === 'POST' && path === '/api') return api(body ?? '');
    return NOT_FOUND;
  };
