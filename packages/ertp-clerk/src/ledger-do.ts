import { DurableObject } from 'cloudflare:workers';
import {
  createIssuerKit,
  openIssuerKit,
  initGnuCashSchema,
  SLOT_TYPE_GUID,
  SLOT_TYPE_STRING,
  asGuid,
  type SqlDatabase,
} from '../../ertp-ledgerguise/src/index.js';
import type {
  AccountPurseAccess,
  AccountPurse,
  Guid,
  IssuerKitForCommodity,
  IssuerKitWithPurseGuids,
  PaymentAccess,
} from '../../ertp-ledgerguise/src/types.js';
import { makeSqlDatabaseFromStorage } from './sql-adapter.js';
import { makeGnuCashZoneKit } from './gnucash-zone.js';
import { makeWebkey } from './webkey-protocol.js';
import type {
  ExportRules,
  ExportRuleContext,
  GnuCashZoneKit,
  SlotCodec,
  TokenMetaBase,
} from './gnucash-zone.js';

const { freeze } = Object;

type GnuCashTokenMeta = TokenMetaBase & {
  commodityGuid?: Guid;
  accountGuid?: Guid;
  checkNumber?: string;
};

type GnuCashExportContext = {
  commodityGuid?: Guid;
};

type ZoneKit = GnuCashZoneKit<GnuCashTokenMeta, GnuCashExportContext>;

const SLOT_PREFIX = 'ledgerguise.webkey.';
const slotNameForReviver = (reviver: string) => `${SLOT_PREFIX}${reviver}`;

const makeExportRules = (helpers: {
  inferPurseGuid: (kit: KitRecord, purse: object) => Promise<Guid>;
}): ExportRules<GnuCashTokenMeta, GnuCashExportContext> => {
  const rules: ExportRules<GnuCashTokenMeta, GnuCashExportContext> = new Map();
  const forReviver = (reviver: string) => {
    const table = new Map();
    rules.set(reviver, table);
    return table;
  };

  const requireKit = (
    context: ExportRuleContext<GnuCashTokenMeta, GnuCashExportContext>,
  ): KitRecord => {
    if (!context.kit) throw new Error('missing kit in export context');
    return context.kit as KitRecord;
  };

  forReviver('issuer').set(
    'makeEmptyPurse',
    async (purse: unknown, context: ExportRuleContext<GnuCashTokenMeta, GnuCashExportContext>) => {
      const kit = requireKit(context);
      // Export rule only runs for known ERTP purse results.
      const accountGuid = await helpers.inferPurseGuid(kit, purse as object);
      return { reviver: 'purse', commodityGuid: context.commodityGuid, accountGuid };
    },
  );
  forReviver('issuer').set(
    'getBrand',
    async (_brand: unknown, context: ExportRuleContext<GnuCashTokenMeta, GnuCashExportContext>) => {
      return { reviver: 'brand', commodityGuid: context.commodityGuid };
    },
  );

  forReviver('mint').set(
    'mintPayment',
    async (payment: unknown, context: ExportRuleContext<GnuCashTokenMeta, GnuCashExportContext>) => {
      const kit = requireKit(context);
      // Export rule only runs for ERTP payment results.
      const checkNumber = kit.payments.getCheckNumber(payment as object);
      return { reviver: 'payment', commodityGuid: context.commodityGuid, checkNumber };
    },
  );
  forReviver('mint').set(
    'getIssuer',
    async (_issuer: unknown, context: ExportRuleContext<GnuCashTokenMeta, GnuCashExportContext>) => {
      return { reviver: 'issuer', commodityGuid: context.commodityGuid };
    },
  );

  forReviver('purse').set(
    'withdraw',
    async (payment: unknown, context: ExportRuleContext<GnuCashTokenMeta, GnuCashExportContext>) => {
      const kit = requireKit(context);
      // Export rule only runs for ERTP payment results.
      const checkNumber = kit.payments.getCheckNumber(payment as object);
      return { reviver: 'payment', commodityGuid: context.commodityGuid, checkNumber };
    },
  );
  forReviver('purse').set(
    'getDepositFacet',
    async (_facet: unknown, context: ExportRuleContext<GnuCashTokenMeta, GnuCashExportContext>) => {
      if (!context.targetMeta.accountGuid) return null;
      return {
        reviver: 'depositFacet',
        commodityGuid: context.commodityGuid,
        accountGuid: context.targetMeta.accountGuid,
      };
    },
  );

  return rules;
};

const slotCodec: SlotCodec<GnuCashTokenMeta> = {
  encode: (meta) => {
    const name = slotNameForReviver(meta.reviver);
    let guidVal: string | null = null;
    let stringVal: string | null = null;
    let slotType = SLOT_TYPE_GUID;
    if (meta.reviver === 'purse' || meta.reviver === 'depositFacet') {
      if (!meta.accountGuid || !meta.commodityGuid) {
        throw new Error('missing purse metadata');
      }
      guidVal = meta.accountGuid;
      stringVal = meta.commodityGuid;
      slotType = SLOT_TYPE_STRING;
    } else if (meta.reviver === 'payment') {
      if (!meta.commodityGuid || !meta.checkNumber) {
        throw new Error('missing payment metadata');
      }
      guidVal = meta.commodityGuid;
      stringVal = meta.checkNumber;
      slotType = SLOT_TYPE_STRING;
    } else if (meta.reviver !== 'bootstrap') {
      if (!meta.commodityGuid) {
        throw new Error('missing commodity metadata');
      }
      guidVal = meta.commodityGuid;
    }
    return { name, slotType, guidVal, stringVal };
  },
  decode: (row) => {
    if (!row.name.startsWith(SLOT_PREFIX)) {
      throw new Error('unknown capability');
    }
    const reviver = row.name.slice(SLOT_PREFIX.length);
    if (reviver === 'purse' || reviver === 'depositFacet') {
      if (!row.guid_val || !row.string_val) {
        throw new Error('invalid purse token');
      }
      return {
        reviver,
        accountGuid: asGuid(row.guid_val),
        commodityGuid: asGuid(row.string_val),
      };
    }
    if (reviver === 'payment') {
      if (!row.guid_val || !row.string_val) {
        throw new Error('invalid payment token');
      }
      return {
        reviver,
        commodityGuid: asGuid(row.guid_val),
        checkNumber: row.string_val,
      };
    }
    if (reviver === 'bootstrap') {
      return { reviver };
    }
    if (!row.guid_val) {
      throw new Error('invalid token');
    }
    return { reviver, commodityGuid: asGuid(row.guid_val) };
  },
  bootstrapMeta: () => ({ reviver: 'bootstrap' }),
  equals: (left, right) =>
    left.reviver === right.reviver &&
    left.commodityGuid === right.commodityGuid &&
    left.accountGuid === right.accountGuid &&
    left.checkNumber === right.checkNumber,
};

type KitRecord = {
  commodityGuid: Guid;
  kit: { issuer: object; brand: object; mint: object };
  payments: PaymentAccess;
  accounts: AccountPurseAccess;
  purses?: IssuerKitWithPurseGuids['purses'];
  purseGuids?: IssuerKitForCommodity['purseGuids'];
};

export class LedgerDurableObject extends DurableObject {
  private readonly state: DurableObjectState;
  private readonly db: SqlDatabase;
  private readonly ready: Promise<void>;
  private readonly kits = new Map<Guid, KitRecord>();
  private readonly zone: ZoneKit['zone'];
  private readonly zoneRegistry: ZoneKit['registry'];
  private readonly zoneMarshal: ZoneKit['marshal'];
  private readonly makeGuid: () => Guid;
  private bootstrap: { makeIssuerKit: (name: string) => object } | null = null;
  private currentCommodityGuid: Guid | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const randomUUID = crypto.randomUUID.bind(crypto);
    const makeToken = () => randomUUID().replace(/-/g, '');
    this.makeGuid = () => asGuid(randomUUID().replace(/-/g, ''));
    this.state = ctx;
    this.db = makeSqlDatabaseFromStorage(ctx.storage.sql);
    const zoneKit = makeGnuCashZoneKit<GnuCashTokenMeta, GnuCashExportContext>({
      db: this.db,
      storage: ctx.storage,
      exportRules: makeExportRules({
        inferPurseGuid: (kit, purse) => this.inferPurseGuid(kit, purse),
      }),
      reifiers: this.makeReifiers(),
      makeToken,
      slotCodec,
      buildMeta: (interfaceName: string) => {
        const commodityGuid = this.currentCommodityGuid;
        if (!commodityGuid) return null;
        if (interfaceName.endsWith(' Brand')) return { reviver: 'brand', commodityGuid };
        if (interfaceName.endsWith(' Issuer')) return { reviver: 'issuer', commodityGuid };
        if (interfaceName.endsWith(' Mint')) return { reviver: 'mint', commodityGuid };
        return null;
      },
    });
    this.zone = zoneKit.zone;
    this.zoneRegistry = zoneKit.registry;
    this.zoneMarshal = zoneKit.marshal;
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

  private makeIssuerKit(name: string) {
    let createdCommodity: Guid | null = null;
    const makeGuid = () => {
      const guid = this.makeGuid();
      if (!createdCommodity) {
        createdCommodity = guid;
        this.currentCommodityGuid = guid;
      }
      return guid;
    };
    const kit = createIssuerKit({
      db: this.db,
      commodity: { namespace: 'COMMODITY', mnemonic: name },
      makeGuid,
      nowMs: () => Date.now(),
      zone: this.zone,
    });
    this.currentCommodityGuid = null;
    const record: KitRecord = {
      commodityGuid: kit.commodityGuid,
      kit: { issuer: kit.issuer, brand: kit.brand, mint: kit.mint },
      payments: kit.payments,
      accounts: {
        makeAccountPurse: (accountGuid: Guid) =>
          openIssuerKit({
            db: this.db,
            commodityGuid: kit.commodityGuid,
            makeGuid: this.makeGuid,
            nowMs: () => Date.now(),
            zone: this.zone,
          }).accounts.makeAccountPurse(accountGuid),
        openAccountPurse: (accountGuid: Guid) =>
          openIssuerKit({
            db: this.db,
            commodityGuid: kit.commodityGuid,
            makeGuid: this.makeGuid,
            nowMs: () => Date.now(),
            zone: this.zone,
          }).accounts.openAccountPurse(accountGuid),
      },
      purses: kit.purses,
    };
    this.kits.set(kit.commodityGuid, record);
    return freeze({ issuer: kit.issuer, brand: kit.brand, mint: kit.mint });
  }

  private getKit(commodityGuid: Guid): KitRecord {
    const existing = this.kits.get(commodityGuid);
    if (existing) return existing;
    this.currentCommodityGuid = commodityGuid;
    const opened = openIssuerKit({
      db: this.db,
      commodityGuid,
      makeGuid: this.makeGuid,
      nowMs: () => Date.now(),
      zone: this.zone,
    });
    this.currentCommodityGuid = null;
    const record: KitRecord = {
      commodityGuid,
      kit: opened.kit,
      payments: opened.payments,
      accounts: opened.accounts,
      purseGuids: opened.purseGuids,
    };
    this.kits.set(commodityGuid, record);
    return record;
  }

  private async inferPurseGuid(record: KitRecord, purse: unknown): Promise<Guid> {
    if (record.purses) {
      // purses.getGuid only accepts real purse objects.
      return record.purses.getGuid(purse as object);
    }
    // purseGuids maps runtime purse objects to GUIDs.
    const guid = record.purseGuids?.get(purse as AccountPurse);
    if (!guid) throw new Error('unknown purse');
    return guid;
  }

  private makeReifiers() {
    const reifiers = new Map();
    reifiers.set('bootstrap', () => this.makeBootstrap());
    reifiers.set('issuer', (meta: { commodityGuid: Guid }) =>
      this.getKit(meta.commodityGuid).kit.issuer,
    );
    reifiers.set('brand', (meta: { commodityGuid: Guid }) =>
      this.getKit(meta.commodityGuid).kit.brand,
    );
    reifiers.set('mint', (meta: { commodityGuid: Guid }) =>
      this.getKit(meta.commodityGuid).kit.mint,
    );
    reifiers.set('purse', (meta: { commodityGuid: Guid; accountGuid: Guid }) => {
      const kit = this.getKit(meta.commodityGuid);
      return kit.accounts.openAccountPurse(meta.accountGuid);
    });
    reifiers.set('depositFacet', (meta: { commodityGuid: Guid; accountGuid: Guid }) => {
      const kit = this.getKit(meta.commodityGuid);
      const purse = kit.accounts.openAccountPurse(meta.accountGuid);
      // AccountPurse doesn't declare getDepositFacet, but the runtime purse does.
      return (purse as unknown as { getDepositFacet: () => object }).getDepositFacet();
    });
    reifiers.set('payment', (meta: { commodityGuid: Guid; checkNumber: string }) => {
      const kit = this.getKit(meta.commodityGuid);
      return kit.payments.openPayment(meta.checkNumber);
    });
    return reifiers;
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
      const token = await this.zoneRegistry.ensureBootstrapToken();
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
    const { obj, meta } = await this.zoneRegistry.resolveToken(token);
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
    const hydrated = await Promise.all(args.map((arg) => this.zoneMarshal.hydrateValue(arg)));
    try {
      const result = await method.apply(obj, hydrated);
      const origin = url.origin;
      const exported = await this.zoneMarshal.exportValue(result, {
        targetMeta: meta,
        methodName,
        origin,
        commodityGuid: meta.commodityGuid,
        kit: meta.commodityGuid ? this.getKit(meta.commodityGuid) : null,
      });
      const payload =
        exported && typeof exported === 'object' && '@' in exported
          ? exported
          : { '=': exported };
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
