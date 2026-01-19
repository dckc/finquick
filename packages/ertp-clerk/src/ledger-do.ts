import { RpcTarget, newWorkersRpcResponse } from 'capnweb';
import { drizzle, type DrizzleSqliteDODatabase } from 'drizzle-orm/durable-sqlite';
import { DurableObject } from 'cloudflare:workers';
import type { DurableObjectState } from 'cloudflare:workers';
import {
  createIssuerKit,
  initGnuCashSchema,
  asGuid,
  type IssuerKitWithPurseGuids,
  type SqlDatabase,
  type Guid,
} from '../../ertp-ledgerguise/src/index.js';
import { makeSqlDatabaseFromStorage } from './sql-adapter';

const makeGuidFactory = () => {
  let guidCounter = 0n;
  return () => {
    const guid = guidCounter;
    guidCounter += 1n;
    return asGuid(guid.toString(16).padStart(32, '0'));
  };
};

const isPromiseLike = (value: unknown): value is Promise<unknown> =>
  !!value && typeof (value as Promise<unknown>).then === 'function';

const isAmountLike = (value: unknown): value is { brand: unknown; value: bigint } =>
  !!value &&
  typeof value === 'object' &&
  'brand' in value &&
  'value' in value &&
  typeof (value as { value: unknown }).value === 'bigint';

const makeExternalWrapper = () => {
  const targetToExternal = new WeakMap<object, object>();
  const externalToTarget = new WeakMap<object, object>();
  const unwrapValue = (value: unknown): unknown => {
    if (value === null || value === undefined) return value;
    if (isPromiseLike(value)) {
      return value.then(unwrapValue);
    }
    if (typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(unwrapValue);
    if (isAmountLike(value)) {
      const amount = value as { brand: unknown; value: bigint };
      return { ...amount, brand: unwrapValue(amount.brand) };
    }
    const target = externalToTarget.get(value as object);
    return target ?? value;
  };
  const wrapValue = (value: unknown): unknown => {
    if (value === null || value === undefined) return value;
    if (isPromiseLike(value)) {
      return value.then(wrapValue);
    }
    if (typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(wrapValue);
    if (isAmountLike(value)) {
      const amount = value as { brand: unknown; value: bigint };
      return Object.freeze({ ...amount, brand: wrapValue(amount.brand) });
    }
    const cached = targetToExternal.get(value as object);
    if (cached) return cached;
    const external = new Proxy(new External(value as object), {
      get(target, prop, receiver) {
        if (prop in target) {
          return Reflect.get(target, prop, receiver);
        }
        const targetValue = (target.target as Record<PropertyKey, unknown>)[prop];
        if (typeof targetValue === 'function') {
          return (...args: unknown[]) => {
            const unwrappedArgs = args.map(unwrapValue);
            return wrapValue(targetValue.apply(target.target, unwrappedArgs));
          };
        }
        return wrapValue(targetValue);
      },
    });
    targetToExternal.set(value as object, external);
    externalToTarget.set(external, value as object);
    return external;
  };
  return { wrapValue };
};

class External<T extends object> extends RpcTarget {
  constructor(readonly target: T) {
    super();
  }
}

const wrapIssuerKit = (wrapValue: (value: unknown) => unknown, kit: IssuerKitWithPurseGuids) => ({
  commodityGuid: kit.commodityGuid,
  brand: wrapValue(kit.brand),
  issuer: wrapValue(kit.issuer),
  mint: wrapValue(kit.mint),
  mintRecoveryPurse: wrapValue(kit.mintRecoveryPurse),
  purses: wrapValue(kit.purses),
  payments: wrapValue(kit.payments),
  mintInfo: wrapValue(kit.mintInfo),
});

class Bootstrap extends RpcTarget {
  constructor(
    private readonly db: SqlDatabase,
    private readonly wrapValue: (value: unknown) => unknown,
    private readonly makeGuid: () => Guid,
  ) {
    super();
  }

  makeIssuerKit(name: string) {
    const kit = createIssuerKit({
      db: this.db,
      commodity: { namespace: 'COMMODITY', mnemonic: name },
      makeGuid: this.makeGuid,
      nowMs: () => Date.now(),
    });
    return wrapIssuerKit(this.wrapValue, kit);
  }
}

export class LedgerDurableObject extends DurableObject {
  private readonly db: SqlDatabase;
  private readonly drizzle: DrizzleSqliteDODatabase<any>;
  private readonly ready: Promise<void>;
  private readonly bootstrap: Bootstrap;

  constructor(ctx: DurableObjectState) {
    super(ctx);
    this.db = makeSqlDatabaseFromStorage(ctx.storage.sql);
    this.drizzle = drizzle(ctx.storage, { logger: false });
    const { wrapValue } = makeExternalWrapper();
    this.bootstrap = new Bootstrap(this.db, wrapValue, makeGuidFactory());
    this.ready = this.ensureSchema();
  }

  private async ensureSchema() {
    const row = this.db
      .prepare<[string], { name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      )
      .get('accounts');
    if (!row) {
      initGnuCashSchema(this.db);
    }
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    return newWorkersRpcResponse(request, this.bootstrap);
  }
}
