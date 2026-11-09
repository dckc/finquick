/**
 * @file What the boot vat calls of the toybox: its devices, typed after
 * their interface guards (src/devices/), and its WebApp vat
 * (examples/webapp.js), none of which export types.
 *
 * TODO(toybox types): import these from the toybox instead, once it
 * exports them, inferred from the guards that check the calls
 * (`TypeFromInterfaceGuard`), so they can't drift from what the devices
 * take. Then this file goes away.
 *
 * TODO(type tests): check that these, and the types inferred from the
 * vats' interface guards (`Uploader`, `ReviewPage`), aren't `any`: a
 * test/types.ts that `yarn typecheck` checks, with a `// @ts-expect-error`
 * on each misuse it should refuse, such as `E(entropy).swis()`, a string
 * from `swiss()` taken as a number, `getTree(3, listing)`, an uploader's
 * `around`, a visit without `latLng`, and `review(n, 'maybe')`; and, for
 * types.ts's ids, a tree id where a webkey or guid goes, a bare string as
 * a webkey, and `'May 9'` as an `IsoDate`. Were one `any`, its line would
 * compile, and its `@ts-expect-error` would fail.
 */
import type {
  FetchAnswer,
  FetchInit,
} from '@vattr/toybox/src/devices/types.ts';
import type {
  BuildRootObject,
  ReadonlyMapStore,
  HttpRequest,
  HttpResponse,
  Remote,
} from '@vattr/toybox/src/types.ts';
import type { TreeId, Webkey } from './types.ts';

declare const BundleCapBrand: unique symbol;
/** Which code a vat runs: opaque, and the same presence for the same code. */
export type BundleCap = { readonly [BundleCapBrand]: true };

/** Unguessable numbers, for a vat, which has no randomness of its own. */
export type Entropy = {
  /** 128 random bits, in hex: unguessable, so fit to be a webkey. */
  swiss(): Webkey;
};

declare const BuildsBrand: unique symbol;
/**
 * A vat's code: a file in the boot directory, as `BootBundles` names it,
 * and the type of the `buildRootObject` it exports, which nothing imports,
 * so the type goes with the name.
 */
export type Code<B extends BuildRootObject<any> = BuildRootObject<any>> =
  string & {
    readonly [BuildsBrand]: B;
  };
/** The root of a vat that runs `C`. */
export type RootOf<C> = C extends Code<infer B> ? ReturnType<B> : never;
/** What a vat that runs `C` is made with. */
export type ParamsOf<C> =
  C extends Code<infer B>
    ? B extends (powers: any, params: infer P) => any
      ? P
      : never
    : never;

/** The boot directory's bundles, by file name. */
export type BootBundles = {
  getBundleCap(name: string): Promise<Remote<BundleCap>>;
};

/** A vat's admin node: its maker's hold on it. */
export type AdminNode = {
  upgrade(bundle: Remote<BundleCap>): Promise<void>;
  restart(): void;
};

/** Makes vats. */
export type VatAdmin = {
  createVat(
    bundle: Remote<BundleCap>,
    params?: object,
  ): Promise<{ root: Remote; adminNode: Remote<AdminNode> }>;
};

/** A tree in a git repository, by its id: its files, as they were. */
export type GitTree = {
  id(): TreeId;
  list(): string[];
  read(path: string): Promise<string>;
  open(path: string): Promise<Remote<GitReader>>;
};

/** A file of a git tree, open: its text, a chunk of whole lines at a time. */
export type GitReader = {
  next(): Promise<{ done: boolean; value?: string }>;
};

/** A git checkout's trees: one by id, or the one a listing lists. */
export type GitTrees = {
  getTree(tree: TreeId | null, listing: string): Promise<Remote<GitTree>>;
};

/** What an ingress serves: something that answers HTTP requests. */
export type HttpHandler = {
  handle(request: HttpRequest): HttpResponse | Promise<HttpResponse>;
};

/** An app socket: whoever serves a handler there answers its requests. */
export type Ingress = {
  serve(handler: Remote<HttpHandler>): void;
};

/** A fetch device: whoever holds it can fetch anything its network reaches. */
export type FetchDevice = {
  fetch(url: string, init?: FetchInit): Promise<FetchAnswer>;
};

/** A web site, narrowed to a URL, with the headers each send carries. */
export type WebApp = {
  /** Narrowed to a path within this one. */
  pathjoin(ref: string): WebApp;
  query(params: Record<string, string | number>): WebApp;
  withHeaders(more: Record<string, string>): WebApp;
  /** Also each entry of `map`, as of each send. */
  withHeaderMap(map: Remote<ReadonlyMapStore<string, string>>): WebApp;
  /** The response's body; throws unless its status is OK. */
  get(): Promise<string>;
  post(body: string): Promise<string>;
};

/** The WebApp vat's root: it makes WebApps whose egress is its own. */
export type WebApps = {
  makeWebApp(url: string, headers?: Record<string, string>): WebApp;
};
