import type { SlotRow, SqlDatabase } from '../../ertp-ledgerguise/src/index.js';
import {
  decodeBigIntRecord,
  encodeBigInt,
  isBigIntRecord,
  isRecord,
  isWebkeyRef,
} from './webkey-codec.js';
import { extractToken, makeWebkey } from './webkey-protocol.js';

type TokenMetaBase = { reviver: string };

type ExportRuleContext<Meta extends TokenMetaBase, Extra extends object = {}> = {
  targetMeta: Meta;
  methodName: string;
  origin: string;
  kit?: unknown;
} & Extra;

type ExportRule<Meta extends TokenMetaBase, Extra extends object = {}> = (
  value: unknown,
  context: ExportRuleContext<Meta, Extra>,
) => Promise<Meta | null>;

type ExportRules<Meta extends TokenMetaBase, Extra extends object = {}> = Map<
  string,
  Map<string, ExportRule<Meta, Extra>>
>;

type Reifier<Meta extends TokenMetaBase> = (meta: Meta) => object;

type Reifiers<Meta extends TokenMetaBase> = Map<string, Reifier<Meta>>;

type Zone = {
  exo: <T extends Record<PropertyKey, unknown>>(
    name: string,
    methods: T,
  ) => Readonly<T>;
};

type SlotCodecRow = Pick<SlotRow, 'name' | 'guid_val' | 'string_val'>;

type SlotCodec<Meta extends TokenMetaBase> = {
  encode: (meta: Meta) => {
    name: string;
    slotType: number;
    guidVal: string | null;
    stringVal: string | null;
  };
  decode: (row: SlotCodecRow) => Meta;
  bootstrapMeta: () => Meta;
  equals?: (left: Meta, right: Meta) => boolean;
};

type GnuCashZoneRegistry<Meta extends TokenMetaBase> = {
  resolveToken: (token: string) => Promise<{ obj: object; meta: Meta }>;
  ensureBootstrapToken: () => Promise<string>;
};

type GnuCashZoneMarshal<Meta extends TokenMetaBase, Extra extends object = {}> = {
  hydrateValue: (value: unknown) => Promise<unknown>;
  exportValue: (value: unknown, context: ExportRuleContext<Meta, Extra>) => Promise<unknown>;
};

type GnuCashZoneKit<Meta extends TokenMetaBase, Extra extends object = {}> = {
  zone: Zone;
  registry: GnuCashZoneRegistry<Meta>;
  marshal: GnuCashZoneMarshal<Meta, Extra>;
};

type StorageLike = {
  get: (key: string) => Promise<string | undefined>;
  put: (key: string, value: string) => Promise<void>;
};

type GnuCashZoneArgs<Meta extends TokenMetaBase, Extra extends object = {}> = {
  db: SqlDatabase;
  storage?: StorageLike;
  exportRules: ExportRules<Meta, Extra>;
  reifiers: Reifiers<Meta>;
  makeToken: () => string;
  slotCodec: SlotCodec<Meta>;
  buildMeta?: (
    interfaceName: string,
    methods: Record<PropertyKey, unknown>,
  ) => Meta | null;
};

const freezeProps = <T extends Record<PropertyKey, unknown>>(
  obj: T,
): Readonly<T> => {
  for (const key of Reflect.ownKeys(obj)) {
    const value = obj[key];
    if (typeof value === 'function') {
      Object.freeze(value);
    }
  }
  return Object.freeze(obj);
};

const makeGnuCashZoneKit = <Meta extends TokenMetaBase, Extra extends object = {}>({
  db,
  storage,
  exportRules,
  reifiers,
  makeToken,
  slotCodec,
  buildMeta,
}: GnuCashZoneArgs<Meta, Extra>): GnuCashZoneKit<Meta, Extra> => {
  const liveToToken = new WeakMap<object, string>();
  const tokenToLive = new Map<string, object>();
  const tokenToMeta = new Map<string, Meta>();
  const zone: Zone = {
    exo: <T extends Record<PropertyKey, unknown>>(
      interfaceName: string,
      methods: T,
    ): Readonly<T> => {
      const target = Object.defineProperty(methods, Symbol.toStringTag, {
        value: `?${interfaceName}?`,
      });
      const frozen = freezeProps(target);
      const token = makeToken();
      liveToToken.set(frozen as object, token);
      tokenToLive.set(token, frozen as object);
      const meta = buildMeta ? buildMeta(interfaceName, methods) : null;
      if (meta) {
        insertSlot(token, meta);
        tokenToMeta.set(token, meta);
      }
      return frozen as Readonly<T>;
    },
  };

  const insertSlot = (token: string, meta: Meta) => {
    const { name, slotType, guidVal, stringVal } = slotCodec.encode(meta);
    db.prepare(
      `INSERT INTO slots(obj_guid, name, slot_type, guid_val, string_val)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(token, name, slotType, guidVal, stringVal);
  };

  const attachMeta = (token: string, meta: Meta) => {
    const known = tokenToMeta.get(token);
    if (known) {
      if (slotCodec.equals && !slotCodec.equals(known, meta)) {
        throw new Error('conflicting token metadata');
      }
      return;
    }
    insertSlot(token, meta);
    tokenToMeta.set(token, meta);
  };

  const resolveToken = async (token: string): Promise<{ obj: object; meta: Meta }> => {
    const live = tokenToLive.get(token);
    const meta = tokenToMeta.get(token);
    if (live && meta) return { obj: live, meta };

    const row = db
      .prepare<[string], SlotCodecRow>('SELECT name, guid_val, string_val FROM slots WHERE obj_guid = ?')
      .get(token);
    if (!row) {
      throw new Error('unknown capability');
    }
    const parsed = slotCodec.decode(row);

    const reifier = reifiers.get(parsed.reviver);
    if (!reifier) throw new Error('unknown capability reviver');
    const obj = reifier(parsed);

    tokenToLive.set(token, obj);
    tokenToMeta.set(token, parsed);
    liveToToken.set(obj, token);
    return { obj, meta: parsed };
  };

  const hydrateValue = async (value: unknown): Promise<unknown> => {
    if (isBigIntRecord(value)) {
      return decodeBigIntRecord(value);
    }
    if (isWebkeyRef(value) && typeof value['@'] === 'string') {
      const token = extractToken(value['@']);
      const resolved = await resolveToken(token);
      return resolved.obj;
    }
    if (Array.isArray(value)) {
      return Promise.all(value.map(entry => hydrateValue(entry)));
    }
    if (isRecord(value)) {
      const entries = await Promise.all(
        Object.entries(value).map(async ([key, entry]) => [
          key,
          await hydrateValue(entry),
        ]),
      );
      return Object.fromEntries(entries);
    }
    return value;
  };

  const exportValue = async (
    value: unknown,
    context: ExportRuleContext<Meta, Extra>,
  ): Promise<unknown> => {
    if (typeof value === 'bigint') return encodeBigInt(value);
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      return Promise.all(value.map(entry => exportValue(entry, context)));
    }
    const token = liveToToken.get(value as object);
    if (token) {
      if (!tokenToMeta.has(token)) {
        const rules = exportRules.get(context.targetMeta.reviver);
        const rule = rules?.get(context.methodName);
        if (!rule) {
          throw new Error('unexportable object');
        }
        const meta = await rule(value, context);
        if (!meta) {
          throw new Error('unexportable object');
        }
        attachMeta(token, meta);
      }
      return { '@': makeWebkey(context.origin, token) };
    }
    if (isRecord(value)) {
      const entries = await Promise.all(
        Object.entries(value).map(async ([key, entry]) => [
          key,
          await exportValue(entry, context),
        ]),
      );
      return Object.fromEntries(entries);
    }
    return value;
  };

  const ensureBootstrapToken = async (): Promise<string> => {
    const existing = await storage?.get('bootstrapToken');
    if (existing) return existing;
    const token = makeToken();
    insertSlot(token, slotCodec.bootstrapMeta());
    if (storage) await storage.put('bootstrapToken', token);
    return token;
  };

  return {
    zone,
    registry: {
      resolveToken,
      ensureBootstrapToken,
    },
    marshal: {
      hydrateValue,
      exportValue,
    },
  };
};

export { makeGnuCashZoneKit };
export type {
  ExportRule,
  ExportRuleContext,
  ExportRules,
  GnuCashZoneKit,
  GnuCashZoneMarshal,
  GnuCashZoneRegistry,
  Reifier,
  Reifiers,
  TokenMetaBase,
  SlotCodec,
};
