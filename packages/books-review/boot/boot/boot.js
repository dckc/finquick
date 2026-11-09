/**
 * @file The boot vat: it serves the books' pages on the app socket. See
 * {@link buildRootObject}.
 *
 * @import { BuildRootObject, Remote } from '@vattr/toybox/src/types.ts';
 * @import { Ingress } from '../../devices.ts';
 */
import { respond } from './http.js';
import { FILES } from './site.js';
import { prepareWeb } from './web.exo.js';

/**
 * @typedef {object} Params what the kernel gives a boot vat, as far as this one uses it
 * @property {Remote<Ingress>} ingress the app socket's
 */

/**
 * The boot vat: it serves the books' pages through its ingress. It holds
 * every device, and uses only the ingress so far.
 *
 * Its root's `start`, which the kernel calls on each start, has nothing to
 * do yet.
 *
 * @type {BuildRootObject<Params>}
 */
export const buildRootObject = ({ E, Far, zone }, { ingress }) => {
  const makeWeb = prepareWeb(zone, respond({ files: FILES }));
  zone.makeOnce('web', () => {
    const web = makeWeb();
    E(ingress).serve(web);
    return web;
  });

  return Far('booksBoot', {
    /** On each start of the kernel: nothing to do yet. */
    start() {},
  });
};
