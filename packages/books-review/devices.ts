/**
 * @file What the boot vat calls of the toybox: its devices, typed after
 * their interface guards (src/devices/), which don't export types.
 *
 * TODO(toybox types): import these from the toybox instead, once it
 * exports them, inferred from the guards that check the calls
 * (`TypeFromInterfaceGuard`), so they can't drift from what the devices
 * take. Then this file goes away.
 */
import type {
  HttpRequest,
  HttpResponse,
  Remote,
} from '@vattr/toybox/src/types.ts';

/** What an ingress serves: something that answers HTTP requests. */
export type HttpHandler = {
  handle(request: HttpRequest): HttpResponse | Promise<HttpResponse>;
};

/** An app socket: whoever serves a handler there answers its requests. */
export type Ingress = {
  serve(handler: Remote<HttpHandler>): void;
};
