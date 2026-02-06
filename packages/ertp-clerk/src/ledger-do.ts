import { DurableObject } from 'cloudflare:workers';
import {
  createIssuerKit,
  initGnuCashSchema,
  asGuid,
  type SqlDatabase,
} from '../../ertp-ledgerguise/src/index.js';
import type { Guid } from '../../ertp-ledgerguise/src/types.js';
import { SLOT_TYPE_STRING } from '../../ertp-ledgerguise/src/gnucash-schema.js';
import { makeSqlDatabaseFromStorage } from './sql-adapter.js';
import { makeLedgerCodec } from './ledger-codec.js';
import { extractToken, makeWebkey } from './webkey-protocol.js';

const { freeze } = Object;


export class LedgerDurableObject extends DurableObject {
  private readonly state: DurableObjectState;
  private readonly db: SqlDatabase;
  private readonly ready: Promise<void>;
  private readonly codec: ReturnType<typeof makeLedgerCodec>;
  private readonly makeGuid: () => Guid;
  private bootstrap: { makeIssuerKit: (name: string) => object } | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const randomUUID = crypto.randomUUID.bind(crypto);
    const makeToken = () => randomUUID().replace(/-/g, '');
    this.makeGuid = () => asGuid(randomUUID().replace(/-/g, ''));
    this.state = ctx;
    this.db = makeSqlDatabaseFromStorage(ctx.storage.sql);
    this.codec = makeLedgerCodec({
      db: this.db,
      nowMs: () => Date.now(),
      makeGuid: this.makeGuid,
      makeToken,
      refCodec: {
        makeRef: token => token,
        parseRef: ref => extractToken(ref),
      },
    });
    this.ready = this.ensureSchema();
  }

  private async ensureSchema() {
    const row = this.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      )
      .get('accounts');
    if (!row) {
      initGnuCashSchema(this.db, { allowTransactionStatements: false });
    }
  }

  private makeBootstrap() {
    if (this.bootstrap) return this.bootstrap;
    this.bootstrap = freeze({
      makeIssuerKit: (name: string) => this.makeIssuerKit(name),
    });
    return this.bootstrap;
  }

  private async ensureBootstrapToken(): Promise<string> {
    const book = this.db
      .prepare<[], { guid: string }>('SELECT guid FROM books LIMIT 1')
      .get();
    const bookGuid = book?.guid;
    if (!bookGuid) throw new Error('missing book guid');
    const row = this.db
      .prepare<[string], { string_val: string | null }>(
        'SELECT string_val FROM slots WHERE obj_guid = ? AND name = ?',
      )
      .get(bookGuid, 'ledgerguise.bootstrap');
    if (row?.string_val) return row.string_val;
    const token = crypto.randomUUID().replace(/-/g, '');
    this.db
      .prepare(
        `INSERT INTO slots(obj_guid, name, slot_type, guid_val, string_val)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(bookGuid, 'ledgerguise.bootstrap', SLOT_TYPE_STRING, null, token);
    return token;
  }

  private makeIssuerKit(name: string) {
    const kit = createIssuerKit({
      db: this.db,
      commodity: { namespace: 'COMMODITY', mnemonic: name },
      makeGuid: this.makeGuid,
      nowMs: () => Date.now(),
    });
    this.codec.registerKit(kit);
    return freeze({ issuer: kit.issuer, brand: kit.brand, mint: kit.mint });
  }

  private bootstrapModule(webkey: string) {
    const module = `import { encodeClientValue, decodeClientValue } from '/webkey-codec.js';
import { extractToken } from '/webkey-protocol.js';
const baseUrl = new URL('/api', globalThis.location.href);
const keyToProxy = (webkey, allegedInterface = 'Remotable') => {
  const post = async (method, ...args) => {
    const url = new URL(baseUrl);
    const token = extractToken(webkey);
    url.searchParams.set('s', token);
    url.searchParams.set('q', method);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify(args.map(encodeClientValue)),
    });
    const data = await res.json();
    if ('=' in data) return decodeClientValue(data['='], keyToProxy);
    if ('@' in data) return keyToProxy(data['@']);
    if ('!' in data) throw new Error(data['!']);
    throw new Error('rpc error');
  };
  const target = { webkey, isProxy: true, post };
  Object.defineProperty(target, Symbol.toStringTag, {
    value: allegedInterface,
    writable: false,
    enumerable: false,
    configurable: false,
  });
  return new Proxy(target, {
    get(innerTarget, prop) {
      if (prop in innerTarget) return innerTarget[prop];
      if (prop === 'then') return undefined;
      return (...args) => innerTarget.post(prop, ...args);
    },
  });
};
const bootstrap = keyToProxy(${JSON.stringify(webkey)});
export { bootstrap, keyToProxy };
`;
    return module;
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    const url = new URL(request.url);
    if (url.pathname === '/webkey-codec.js') {
      // TODO: review whether this should be served from the worker root instead of the DO.
      const module = `export { encodeClientValue, decodeClientValue } from './webkey-codec.js';\n`;
      return new Response(module, {
        headers: { 'content-type': 'application/javascript; charset=utf-8' },
      });
    }
    if (url.pathname === '/webkey-protocol.js') {
      // TODO: review whether this should be served from the worker root instead of the DO.
      const module = `export { extractToken, makeWebkey } from './webkey-protocol.js';\n`;
      return new Response(module, {
        headers: { 'content-type': 'application/javascript; charset=utf-8' },
      });
    }
    if (url.pathname === '/bootstrap') {
      const token = await this.ensureBootstrapToken();
      const webkey = makeWebkey(url.origin, token);
      if (url.searchParams.get('format') === 'json') {
        return new Response(JSON.stringify({ webkey }), {
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      }
      return new Response(this.bootstrapModule(webkey), {
        headers: { 'content-type': 'application/javascript; charset=utf-8' },
      });
    }
    if (url.pathname === '/api') {
      if (request.method !== 'POST') {
        return new Response('method not allowed', { status: 405 });
      }
      return this.handleRpc(request);
    }
    return new Response('ertp-clerk: not implemented', { status: 501 });
  }

  private async handleRpc(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const token = url.searchParams.get('s');
    const methodName = url.searchParams.get('q');
    if (!token || !methodName) {
      return new Response('missing capability or method', { status: 400 });
    }
    let obj: unknown;
    try {
      const bootstrapToken = await this.ensureBootstrapToken();
      if (token === bootstrapToken) {
        obj = this.makeBootstrap();
      } else {
        obj = this.codec.build({ '@': token });
      }
    } catch {
      return new Response(JSON.stringify({ '!': 'unknown capability' }), {
        status: 404,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }
    const target = obj as Record<string, unknown>;
    const method = target[methodName];
    if (typeof method !== 'function') {
      return new Response(JSON.stringify({ '!': 'no such method' }), {
        status: 404,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }
    let args = [];
    try {
      const body = await request.text();
      args = body ? JSON.parse(body) : [];
      if (!Array.isArray(args)) throw new Error('args must be array');
    } catch {
      return new Response(JSON.stringify({ '!': 'invalid request' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }
    const hydrated = args.map((arg) => this.codec.build(arg));
    try {
      const result = await method.apply(obj, hydrated);
      const exported = this.codec.recognize(result);
      let payload: unknown;
      if (exported && typeof exported === 'object' && '@' in exported) {
        const ref = String((exported as { '@': string })['@']);
        payload = { '@': makeWebkey(url.origin, extractToken(ref)) };
      } else {
        payload = { '=': exported };
      }
      return new Response(JSON.stringify(payload), {
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('rpc error', { methodName, err: message });
      return new Response(JSON.stringify({ '!': message }), {
        status: 422,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }
  }
}
