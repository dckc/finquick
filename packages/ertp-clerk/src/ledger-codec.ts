import type { SqlDatabase } from '../../ertp-ledgerguise/src/index.js';
import { asGuid, openIssuerKit } from '../../ertp-ledgerguise/src/index.js';
import type {
  AccountPurse,
  Guid,
  IssuerKitForCommodity,
  IssuerKitWithPurseGuids,
  PaymentAccess,
} from '../../ertp-ledgerguise/src/types.js';
import { SLOT_TYPE_STRING } from '../../ertp-ledgerguise/src/gnucash-schema.js';
import type { WireEncoding } from './webkey-codec.js';
import {
  decodeBigIntRecord,
  encodeBigInt,
  isBigIntRecord,
  isRecord,
} from './webkey-codec.js';

type Depiction = WireEncoding;
type Uncall = readonly [
  receiver: unknown,
  method: string | null,
  args: ReadonlyArray<unknown>,
];

type AssetChainStep =
  | Readonly<{ get: string | number }>
  | Readonly<{ call: { method: string | null; args: ReadonlyArray<unknown> } }>;

type RefCodec = {
  makeRef: (token: string) => string;
  parseRef: (ref: string) => string;
};

type KitRecord = {
  commodityGuid: Guid;
  kit: { issuer: object; brand: object; mint: object };
  payments: PaymentAccess;
  purses?: IssuerKitWithPurseGuids['purses'];
  purseGuids?: IssuerKitForCommodity['purseGuids'];
  accounts: IssuerKitForCommodity['accounts'];
  knownPurses: Set<AccountPurse>;
  paymentByCheck: Map<string, object>;
  accountsWrapper?: IssuerKitForCommodity['accounts'];
  paymentsWrapper?: IssuerKitForCommodity['payments'];
};

type LedgerCodecArgs = {
  db: SqlDatabase;
  nowMs: () => number;
  makeGuid: () => Guid;
  makeToken: () => string;
  refCodec: RefCodec;
};

type CallRecord = {
  call: {
    receiver: Depiction;
    method: string | null;
    args: ReadonlyArray<Depiction>;
  };
};

type GetRecord = {
  get: {
    receiver: Depiction;
    key: string | number;
  };
};

const { freeze } = Object;
const OPEN_ASSET_TOKEN = 'openAsset';
const SLOT_NAME_WEBKEY = 'webkey';

const objectMap = <T>(
  source: Record<string, unknown>,
  map: (value: unknown, key: string) => T,
): Readonly<Record<string, T>> =>
  freeze(
    Object.fromEntries(
      Object.entries(source).map(([key, value]) => [key, map(value, key)]),
    ),
  );

const isPassByCopyDefault = (value: unknown): boolean => {
  if (value === null) return true;
  const t = typeof value;
  if (t !== 'object') return true;
  if (Array.isArray(value)) return true;
  if (!isRecord(value)) return false;
  for (const entry of Object.values(value)) {
    if (typeof entry === 'function') return false;
  }
  return true;
};

const isRefRecord = (value: unknown): value is { '@': string } =>
  isRecord(value) && '@' in value && typeof value['@'] === 'string';

const isCallRecord = (value: unknown): value is CallRecord =>
  isRecord(value) && 'call' in value && isRecord(value.call);

const isGetRecord = (value: unknown): value is GetRecord =>
  isRecord(value) && 'get' in value && isRecord(value.get);

const makeBuilder = (args: {
  refCodec: RefCodec;
  openAsset: (commodityGuid: string) => {
    issuer: object;
    brand: object;
    mint: object;
    accounts: IssuerKitForCommodity['accounts'];
    payments: IssuerKitForCommodity['payments'];
  };
  purseToGuid: WeakMap<object, Guid>;
  liveToToken: WeakMap<object, string>;
  tokenToLive: Map<string, object>;
  loadDepiction: (token: string) => Depiction;
}) => {
  const { refCodec, openAsset, purseToGuid, liveToToken, tokenToLive, loadDepiction } = args;
  const depositFacetByPurse = new WeakMap<object, object>();
  const build = (depiction: Depiction): unknown => {
    if (isBigIntRecord(depiction)) return decodeBigIntRecord(depiction);
    if (isRefRecord(depiction)) {
      const token = refCodec.parseRef(depiction['@']);
      if (token === OPEN_ASSET_TOKEN) return openAsset;
      const existing = tokenToLive.get(token);
      if (existing) return existing;
      const value = build(loadDepiction(token));
      if (value && typeof value === 'object') {
        liveToToken.set(value as object, token);
        tokenToLive.set(token, value as object);
      }
      return value;
    }
    if (isCallRecord(depiction)) {
      const receiver = build(depiction.call.receiver);
      const args = depiction.call.args.map(arg => build(arg));
      const methodName = depiction.call.method;
      if (!methodName) {
        if (typeof receiver !== 'function')
          throw new Error('call target is not a function');
        return (receiver as (...innerArgs: unknown[]) => unknown)(...args);
      }
      if (methodName === 'getDepositFacet') {
        const guid = purseToGuid.get(receiver as object);
        if (guid) {
          const existing = depositFacetByPurse.get(receiver as object);
          if (existing) return existing;
          const method = (receiver as { getDepositFacet: () => object })
            .getDepositFacet;
          if (typeof method !== 'function')
            throw new Error('unknown call target');
          const facet = method.call(receiver);
          depositFacetByPurse.set(receiver as object, facet);
          return facet;
        }
      }
      const method = (receiver as Record<string, unknown>)[methodName];
      if (typeof method !== 'function') throw new Error('unknown call target');
      return (method as (...innerArgs: unknown[]) => unknown)(...args);
    }
    if (isGetRecord(depiction)) {
      const receiver = build(depiction.get.receiver) as Record<string, unknown>;
      const key = depiction.get.key;
      return receiver[key];
    }
    if (Array.isArray(depiction)) {
      return freeze(depiction.map(entry => build(entry as Depiction)));
    }
    if (isRecord(depiction)) {
      return objectMap(depiction, entry => build(entry as Depiction));
    }
    return depiction;
  };
  return freeze({ build });
};

const makeLedgerCodec = ({
  db,
  nowMs,
  makeGuid,
  makeToken: _makeToken,
  refCodec,
}: LedgerCodecArgs) => {
  const kits = new Map<Guid, KitRecord>();
  const uncallersByObject = new WeakMap<object, () => Uncall | null>();
  const purseToGuid = new WeakMap<object, Guid>();
  const liveToToken = new WeakMap<object, string>();
  const tokenToLive = new Map<string, object>();
  const tokenToDepiction = new Map<string, Depiction>();

  const openAsset = (commodityGuid: string) => {
    const guid = asGuid(commodityGuid);
    let kit = kits.get(guid);
    if (!kit) {
      const opened = openIssuerKit({
        db,
        commodityGuid: guid,
        makeGuid,
        nowMs,
      });
      const newKit: KitRecord = {
        commodityGuid: guid,
        kit: opened.kit,
        payments: opened.payments,
        accounts: opened.accounts,
        purseGuids: opened.purseGuids,
        knownPurses: new Set(),
        paymentByCheck: new Map(),
      };
      newKit.accountsWrapper = freeze({
        makeAccountPurse: newKit.accounts.makeAccountPurse,
        openAccountPurse: (accountGuid: Guid | string) => {
          const purseGuid = asGuid(String(accountGuid));
          const purse = newKit.accounts.openAccountPurse(purseGuid);
          newKit.knownPurses.add(purse);
          purseToGuid.set(purse, purseGuid);
          return purse;
        },
      });
      newKit.paymentsWrapper = freeze({
        getCheckNumber: newKit.payments.getCheckNumber,
        openPayment: (checkNumber: string) => {
          const existing = newKit.paymentByCheck.get(checkNumber);
          if (existing) return existing;
          const payment = newKit.payments.openPayment(checkNumber);
          newKit.paymentByCheck.set(checkNumber, payment);
          // registry handled by uncaller sidecar
          return payment;
        },
      });
      kits.set(guid, newKit);
      uncallersByObject.set(opened.kit.issuer, () => [
        opened.kit.mint,
        'getIssuer',
        [],
      ]);
      uncallersByObject.set(opened.kit.brand, () => [
        opened.kit.issuer,
        'getBrand',
        [],
      ]);
      uncallersByObject.set(opened.kit.mint, () => [
        getAssetProp,
        null,
        [newKit.commodityGuid, 'mint'],
      ]);
      uncallersByObject.set(opened.accounts as object, () => [
        getAssetProp,
        null,
        [newKit.commodityGuid, 'accounts'],
      ]);
      uncallersByObject.set(opened.payments as object, () => [
        getAssetProp,
        null,
        [newKit.commodityGuid, 'payments'],
      ]);
      kit = newKit;
    }
    if (!kit) {
      throw new Error('failed to open asset');
    }
    return {
      issuer: kit.kit.issuer,
      brand: kit.kit.brand,
      mint: kit.kit.mint,
      accounts: kit.accountsWrapper ?? kit.accounts,
      payments: kit.paymentsWrapper ?? kit.payments,
    };
  };

  const getAssetProp = (commodityGuid: Guid | string, key: string | number) => {
    const asset = openAsset(String(commodityGuid)) as Record<string, unknown>;
    return asset[key];
  };

  const callAssetProp = (
    commodityGuid: Guid | string,
    key: string | number,
    method: string | null,
    args: ReadonlyArray<unknown>,
  ) => {
    const receiver = getAssetProp(commodityGuid, key);
    if (!method) {
      if (typeof receiver !== 'function')
        throw new Error('call target is not a function');
      return (receiver as (...innerArgs: unknown[]) => unknown)(...args);
    }
    const fn = (receiver as Record<string, unknown>)[method];
    if (typeof fn !== 'function') throw new Error('unknown call target');
    return (fn as (...innerArgs: unknown[]) => unknown)(...args);
  };

  const callAssetChain = (
    commodityGuid: Guid | string,
    steps: ReadonlyArray<AssetChainStep>,
  ) => {
    let current: unknown = openAsset(String(commodityGuid));
    for (const step of steps) {
      if ('get' in step) {
        current = (current as Record<string, unknown>)[step.get];
        continue;
      }
      const { method, args } = step.call;
      if (!method) {
        if (typeof current !== 'function')
          throw new Error('call target is not a function');
        current = (current as (...innerArgs: unknown[]) => unknown)(...args);
        continue;
      }
      const fn = (current as Record<string, unknown>)[method];
      if (typeof fn !== 'function') throw new Error('unknown call target');
      current = (fn as (...innerArgs: unknown[]) => unknown)(...args);
    }
    return current;
  };

  const registerKit = (
    kit:
      | IssuerKitWithPurseGuids
      | { commodityGuid: Guid; kit: IssuerKitForCommodity },
  ) => {
    if ('kit' in kit && 'accounts' in kit.kit) {
      const record: KitRecord = {
        commodityGuid: kit.commodityGuid,
        kit: kit.kit.kit,
        payments: kit.kit.payments,
        accounts: kit.kit.accounts,
        purseGuids: kit.kit.purseGuids,
        knownPurses: new Set(),
        paymentByCheck: new Map(),
      };
      record.accountsWrapper = freeze({
        makeAccountPurse: record.accounts.makeAccountPurse,
        openAccountPurse: (accountGuid: Guid | string) => {
          const guid = asGuid(String(accountGuid));
          const purse = record.accounts.openAccountPurse(guid);
          record.knownPurses.add(purse);
          purseToGuid.set(purse, guid);
          return purse;
        },
      });
      record.paymentsWrapper = freeze({
        getCheckNumber: record.payments.getCheckNumber,
        openPayment: (checkNumber: string) => {
          const existing = record.paymentByCheck.get(checkNumber);
          if (existing) return existing;
          const payment = record.payments.openPayment(checkNumber);
          record.paymentByCheck.set(checkNumber, payment);
          // registry handled by uncaller sidecar
          return payment;
        },
      });
      kits.set(kit.commodityGuid, record);
      uncallersByObject.set(record.kit.issuer, () => [
        record.kit.mint,
        'getIssuer',
        [],
      ]);
      uncallersByObject.set(record.kit.brand, () => [
        record.kit.issuer,
        'getBrand',
        [],
      ]);
      uncallersByObject.set(record.kit.mint, () => [
        getAssetProp,
        null,
        [record.commodityGuid, 'mint'],
      ]);
      uncallersByObject.set(record.accounts as object, () => [
        getAssetProp,
        null,
        [record.commodityGuid, 'accounts'],
      ]);
      uncallersByObject.set(record.payments as object, () => [
        getAssetProp,
        null,
        [record.commodityGuid, 'payments'],
      ]);
      return;
    }
    const localKit = kit as IssuerKitWithPurseGuids;
    openAsset(String(localKit.commodityGuid));
    const record = kits.get(localKit.commodityGuid) as KitRecord;
    record.kit = {
      issuer: localKit.issuer,
      brand: localKit.brand,
      mint: localKit.mint,
    };
    record.purses = localKit.purses;
    record.payments = localKit.payments;
    record.accountsWrapper =
      record.accountsWrapper ??
      freeze({
        makeAccountPurse: record.accounts.makeAccountPurse,
        openAccountPurse: (guid: Guid) => {
          const purse = record.accounts.openAccountPurse(guid);
          record.knownPurses.add(purse);
          purseToGuid.set(purse, guid);
          return purse;
        },
      });
    record.paymentsWrapper =
      record.paymentsWrapper ??
      freeze({
        getCheckNumber: record.payments.getCheckNumber,
        openPayment: (checkNumber: string) => {
          const existing = record.paymentByCheck.get(checkNumber);
          if (existing) return existing;
          const payment = record.payments.openPayment(checkNumber);
          record.paymentByCheck.set(checkNumber, payment);
          // registry handled by uncaller sidecar
          return payment;
        },
      });
    uncallersByObject.set(record.kit.issuer, () => [
      record.kit.mint,
      'getIssuer',
      [],
    ]);
    uncallersByObject.set(record.kit.brand, () => [
      record.kit.issuer,
      'getBrand',
      [],
    ]);
    uncallersByObject.set(record.kit.mint, () => [
      getAssetProp,
      null,
      [record.commodityGuid, 'mint'],
    ]);
    uncallersByObject.set(record.accounts as object, () => [
      getAssetProp,
      null,
      [record.commodityGuid, 'accounts'],
    ]);
    uncallersByObject.set(record.payments as object, () => [
      getAssetProp,
      null,
      [record.commodityGuid, 'payments'],
    ]);
  };

  const depictCall = (
    receiver: Depiction,
    method: string | null,
    args: ReadonlyArray<Depiction>,
  ): Depiction =>
    freeze({
      call: {
        receiver,
        method,
        args: freeze(args),
      },
    });

  const depictGet = (receiver: Depiction, key: string | number): Depiction =>
    freeze({
      get: {
        receiver,
        key,
      },
    });

  const depictOpenAsset = (commodityGuid: Guid): Depiction =>
    depictCall(freeze({ '@': refCodec.makeRef(OPEN_ASSET_TOKEN) }), null, [
      String(commodityGuid),
    ]);

  const portrayalToDepiction = (
    uncall: Uncall,
    encodeArg: (value: unknown) => Depiction,
  ): Depiction => {
    const [receiver, method, args] = uncall;
    if (receiver === openAsset) {
      if (method) throw new Error('unexpected method for openAsset');
      const [commodityGuid] = args;
      return depictOpenAsset(asGuid(String(commodityGuid)));
    }
    if (receiver === getAssetProp) {
      if (method) throw new Error('unexpected method for getAssetProp');
      const [commodityGuid, key] = args as [Guid | string, string | number];
      return depictGet(depictOpenAsset(asGuid(String(commodityGuid))), key);
    }
    if (receiver === callAssetProp) {
      if (method) throw new Error('unexpected method for callAssetProp');
      const [commodityGuid, key, innerMethod, innerArgs] = args as [
        Guid | string,
        string | number,
        string | null,
        ReadonlyArray<unknown>,
      ];
      return depictCall(
        depictGet(depictOpenAsset(asGuid(String(commodityGuid))), key),
        innerMethod ?? null,
        freeze((innerArgs ?? []).map(arg => encodeArg(arg))),
      );
    }
    if (receiver === callAssetChain) {
      if (method) throw new Error('unexpected method for callAssetChain');
      const [commodityGuid, steps] = args as [
        Guid | string,
        ReadonlyArray<AssetChainStep>,
      ];
      let current: Depiction = depictOpenAsset(asGuid(String(commodityGuid)));
      for (const step of steps ?? []) {
        if ('get' in step) {
          current = depictGet(current, step.get);
          continue;
        }
        const innerArgs = step.call.args ?? [];
        current = depictCall(
          current,
          step.call.method ?? null,
          freeze(innerArgs.map(arg => encodeArg(arg))),
        );
      }
      return current;
    }
    return depictCall(
      encodeArg(receiver),
      method ?? null,
      freeze(args.map(arg => encodeArg(arg))),
    );
  };

  const insertSlot = (token: string, depiction: Depiction) => {
    db.prepare(
      `INSERT INTO slots(obj_guid, name, slot_type, guid_val, string_val)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      token,
      SLOT_NAME_WEBKEY,
      SLOT_TYPE_STRING,
      null,
      JSON.stringify(depiction),
    );
  };

  const loadDepiction = (token: string): Depiction => {
    const cached = tokenToDepiction.get(token);
    if (cached) return cached;
    const row = db
      .prepare<[string, string], { string_val: string | null }>(
        'SELECT string_val FROM slots WHERE obj_guid = ? AND name = ?',
      )
      .get(token, SLOT_NAME_WEBKEY);
    if (!row?.string_val) throw new Error('unknown capability');
    const depiction = JSON.parse(row.string_val) as Depiction;
    tokenToDepiction.set(token, depiction);
    return depiction;
  };

  const uncallers: Array<(value: unknown) => Uncall | null> = [
    (value: unknown) => {
      const uncaller = uncallersByObject.get(value as object);
      return uncaller ? uncaller() : null;
    },
    (value: unknown) => {
      const purse = value as AccountPurse;
      for (const kit of kits.values()) {
        try {
          const accountGuid = kit.purses
            ? kit.purses.getGuid(purse)
            : kit.purseGuids?.get(purse);
          if (!accountGuid) continue;
          kit.knownPurses.add(purse);
          purseToGuid.set(purse as object, accountGuid);
          const uncall: Uncall = [
            callAssetProp,
            null,
            [
              kit.commodityGuid,
              'accounts',
              'openAccountPurse',
              [String(accountGuid)],
            ],
          ];
          uncallersByObject.set(purse as object, () => uncall);
          return uncall;
        } catch {
          // ignore
        }
      }
      return null;
    },
    (value: unknown) => {
      const payment = value as object;
      for (const kit of kits.values()) {
        try {
          const checkNumber = kit.payments.getCheckNumber(payment);
          kit.paymentByCheck.set(checkNumber, payment);
          const uncall: Uncall = [
            callAssetProp,
            null,
            [kit.commodityGuid, 'payments', 'openPayment', [checkNumber]],
          ];
          uncallersByObject.set(payment, () => uncall);
          return uncall;
        } catch {
          // ignore
        }
      }
      return null;
    },
    (value: unknown) => {
      const depositFacet = value as object;
      for (const kit of kits.values()) {
        for (const purse of kit.knownPurses) {
          const facet = (
            purse as unknown as { getDepositFacet: () => object }
          ).getDepositFacet();
          if (facet === depositFacet) {
            const accountGuid = kit.purses?.getGuid(purse as AccountPurse);
            if (!accountGuid) return null;
            const uncall: Uncall = [
              callAssetChain,
              null,
              [
                kit.commodityGuid,
                [
                  { get: 'accounts' },
                  {
                    call: {
                      method: 'openAccountPurse',
                      args: [String(accountGuid)],
                    },
                  },
                  { call: { method: 'getDepositFacet', args: [] } },
                ],
              ],
            ];
            uncallersByObject.set(depositFacet, () => uncall);
            return uncall;
          }
        }
      }
      return null;
    },
  ];

  const encodeArg = (value: unknown): Depiction => {
    if (typeof value === 'bigint') return freeze(encodeBigInt(value));
    if (isBigIntRecord(value)) return freeze(value);
    if (isRefRecord(value)) return freeze(value);
    if (isPassByCopyDefault(value)) {
      if (Array.isArray(value)) {
        return freeze(value.map(entry => encodeArg(entry)));
      }
      if (isRecord(value)) {
        return objectMap(value, entry => encodeArg(entry));
      }
      return value as Depiction;
    }
    return recognize(value);
  };

  const depictObject = (value: unknown): Depiction => {
    for (const uncaller of uncallers) {
      const uncall = uncaller(value);
      if (uncall) return portrayalToDepiction(uncall, encodeArg);
    }
    throw new Error('unregistered object');
  };

  const recognize = (value: unknown): Depiction => {
    if (typeof value === 'bigint') return freeze(encodeBigInt(value));
    if (isBigIntRecord(value)) return freeze(value);
    if (isRefRecord(value)) return freeze(value);
    if (isPassByCopyDefault(value)) {
      if (Array.isArray(value)) {
        return freeze(value.map(entry => recognize(entry)));
      }
      if (isRecord(value)) {
        return objectMap(value, entry => recognize(entry));
      }
      return value as Depiction;
    }
    const obj = value as object;
    const existing = liveToToken.get(obj);
    if (existing) return freeze({ '@': refCodec.makeRef(existing) });
    const depiction = depictObject(value);
    const token = _makeToken();
    liveToToken.set(obj, token);
    tokenToLive.set(token, obj);
    tokenToDepiction.set(token, depiction);
    insertSlot(token, depiction);
    return freeze({ '@': refCodec.makeRef(token) });
  };

  const { build } = makeBuilder({
    refCodec,
    openAsset,
    purseToGuid,
    liveToToken,
    tokenToLive,
    loadDepiction,
  });

  const registerUncaller = (obj: object, uncaller: () => Uncall | null) => {
    uncallersByObject.set(obj, uncaller);
  };

  return freeze({
    recognize,
    build,
    registerKit,
    registerUncaller,
  });
};

export type { Depiction, RefCodec };
export { makeLedgerCodec };
