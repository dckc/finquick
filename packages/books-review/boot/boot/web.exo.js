/**
 * @file The app socket's handler, a durable kind. See {@link prepareWeb}.
 *
 * @import { HttpRequest, HttpResponse, Powers } from '@vattr/toybox/src/types.ts';
 */

/**
 * The kind of Web the app socket serves; each incarnation's `handle`
 * answers its requests.
 *
 * @param {Powers['zone']} zone
 * @param {(request: HttpRequest) => HttpResponse | Promise<HttpResponse>} handle
 */
export const prepareWeb = (zone, handle) =>
  zone.exoClass('Web', undefined, () => ({}), {
    /** @param {HttpRequest} request */
    handle(request) {
      return handle(request);
    },
  });
