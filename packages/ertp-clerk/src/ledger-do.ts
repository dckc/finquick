import { RpcTarget, newWorkersRpcResponse } from 'capnweb';
import { drizzle, type DrizzleSqliteDODatabase } from 'drizzle-orm/durable-sqlite';
import { DurableObject } from 'cloudflare:workers';
import type { DurableObjectState } from 'cloudflare:workers';
import type { Env } from '../worker-configuration';
import {
  createIssuerKit,
  initGnuCashSchema,
  asGuid,
  type SqlDatabase,
  type Guid,
  type Zone,
} from '../../ertp-ledgerguise/src/index.js';
import { makeSqlDatabaseFromStorage } from './sql-adapter';

const { freeze } = Object;

const makeGuid = () => asGuid(crypto.randomUUID().replace(/-/g, ''));

const isAmountLike = (value: unknown): value is { brand: unknown; value: unknown } =>
  !!value && typeof value === 'object' && 'brand' in value && 'value' in value;

const asAmountValue = (value: unknown): bigint => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  if (typeof value === 'string') return BigInt(value);
  throw new Error('amount value must be bigint-compatible');
};

const normalizeAmountLike = (
  value: { brand: unknown; value: unknown },
  target: object,
) => {
  const targetRecord = target as {
    getBrand?: () => unknown;
    getIssuer?: () => { getBrand?: () => unknown };
    getCurrentAmount?: () => { brand?: unknown };
  };
  const targetBrand =
    targetRecord.getBrand?.() ??
    targetRecord.getIssuer?.()?.getBrand?.() ??
    targetRecord.getCurrentAmount?.()?.brand ??
    undefined;
  return {
    ...value,
    brand: targetBrand ?? value.brand,
    value: asAmountValue(value.value),
  };
};

const normalizeArgForTarget = (arg: unknown, target: object): unknown => {
  if (isAmountLike(arg)) {
    return normalizeAmountLike(arg, target);
  }
  if (arg && typeof arg === 'object' && 'amount' in arg) {
    const record = arg as { amount?: unknown };
    if (record.amount && isAmountLike(record.amount)) {
      return {
        ...arg,
        amount: normalizeAmountLike(record.amount, target),
      };
    }
  }
  return arg;
};

const makeRpcZone = (): Zone => ({
  exo: (_interfaceName, methods) => {
    class ExoTarget extends RpcTarget {}
    for (const key of Reflect.ownKeys(methods)) {
      const value = (methods as Record<PropertyKey, unknown>)[key];
      if (typeof value === 'function') {
        const wrappedMethod = function (this: object, ...args: unknown[]) {
          return value(...args.map((arg) => normalizeArgForTarget(arg, this)));
        };
        freeze(wrappedMethod);
        Object.defineProperty(ExoTarget.prototype, key, {
          value: wrappedMethod,
          writable: false,
        });
        continue;
      }
      Object.defineProperty(ExoTarget.prototype, key, {
        get() {
          return value;
        },
      });
    }
    freeze(ExoTarget.prototype);
    return freeze(new ExoTarget());
  },
});

class Bootstrap extends RpcTarget {
  constructor(
    private readonly db: SqlDatabase,
    private readonly makeGuid: () => Guid,
    private readonly zone: Zone,
  ) {
    super();
  }

  makeIssuerKit(name: string) {
    const kit = createIssuerKit({
      db: this.db,
      commodity: { namespace: 'COMMODITY', mnemonic: name },
      makeGuid: this.makeGuid,
      nowMs: () => Date.now(),
      zone: this.zone,
    });
    return kit;
  }
}

export class LedgerDurableObject extends DurableObject {
  private readonly db: SqlDatabase;
  private readonly drizzle: DrizzleSqliteDODatabase<any>;
  private readonly ready: Promise<void>;
  private readonly bootstrap: Bootstrap;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.db = makeSqlDatabaseFromStorage(ctx.storage.sql);
    this.drizzle = drizzle(ctx.storage, { logger: false });
    this.bootstrap = new Bootstrap(this.db, makeGuid, makeRpcZone());
    this.ready = this.ensureSchema();
  }

  private async ensureSchema() {
    const row = this.db
      .prepare<[string], { name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      )
      .get('accounts');
    if (!row) {
      // TODO: replace schema bootstrap with drizzle migrations.
      initGnuCashSchema(this.db, { allowTransactionStatements: false });
    }
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    return newWorkersRpcResponse(request, this.bootstrap);
  }
}
