import {
  createIssuerKit,
  ensureGnuCashSchema,
  asGuid,
  type SqlDatabase,
} from '../../ertp-ledgerguise/src/index.js';
import type { Guid } from '../../ertp-ledgerguise/src/types.js';
import { SLOT_TYPE_STRING } from '../../ertp-ledgerguise/src/gnucash-schema.js';
import { makeSqlDatabaseFromStorage } from './sql-adapter.js';
import { makeLedgerCodec } from './ledger-codec.js';
import type { WireEncoding } from './webkey-codec.js';
import { extractToken } from './webkey-protocol.js';
import { WebkeyRpcDurableObject } from './webkey-do.js';

const { freeze } = Object;

const getBookGuid = (db: SqlDatabase): Guid => {
  const book = db
    .prepare<[], { guid: string }>('SELECT guid FROM books LIMIT 1')
    .get();
  const bookGuid = book?.guid;
  if (!bookGuid) throw new Error('missing book guid');
  return asGuid(bookGuid);
};

const getOrInsertSlotString = (
  db: SqlDatabase,
  objGuid: Guid,
  name: string,
  makeValue: () => string,
): string => {
  const row = db
    .prepare<[string, string], { string_val: string | null }>(
      'SELECT string_val FROM slots WHERE obj_guid = ? AND name = ?',
    )
    .get(objGuid, name);
  if (row?.string_val) return row.string_val;
  const value = makeValue();
  db.prepare(
    `INSERT INTO slots(obj_guid, name, slot_type, string_val)
     VALUES (?, ?, ?, ?)`,
  ).run(objGuid, name, SLOT_TYPE_STRING, value);
  return value;
};

type IO = {
  makeToken: () => string;
  makeGuid: () => Guid;
  nowMs: () => number;
};

class LedgerDurableObjectBase extends WebkeyRpcDurableObject {
  readonly #db: SqlDatabase;
  readonly #readyPromise: Promise<void>;
  readonly #codec: ReturnType<typeof makeLedgerCodec>;
  readonly #makeGuid: () => Guid;
  readonly #nowMs: () => number;
  readonly #makeToken: () => string;
  readonly #bootstrap: { makeIssuerKit: (name: string) => object };

  constructor(ctx: DurableObjectState, env: Env, io: IO) {
    super(ctx, env);
    this.#makeGuid = io.makeGuid;
    this.#makeToken = io.makeToken;
    this.#nowMs = io.nowMs;
    this.#db = makeSqlDatabaseFromStorage(ctx.storage.sql);
    this.#bootstrap = freeze({
      makeIssuerKit: (name: string) => this.makeIssuerKit(name),
    });
    this.#codec = makeLedgerCodec({
      db: this.#db,
      nowMs: this.#nowMs,
      makeGuid: this.#makeGuid,
      makeToken: this.#makeToken,
      // XXX why do we want/need this?
      refCodec: {
        makeRef: token => token,
        parseRef: ref => extractToken(ref),
      },
    });
    this.#readyPromise = Promise.resolve().then(() =>
      ensureGnuCashSchema(this.#db, { allowTransactionStatements: false }),
    );
  }

  protected ready(): Promise<void> {
    return this.#readyPromise;
  }

  protected async ensureBootstrapToken(): Promise<string> {
    const bookGuid = getBookGuid(this.#db);
    return getOrInsertSlotString(
      this.#db,
      bookGuid,
      'ledgerguise.bootstrap',
      this.#makeToken,
    );
  }

  protected async resolveCapability(token: string): Promise<unknown> {
    const bootstrapToken = await this.ensureBootstrapToken();
    if (token === bootstrapToken) {
      return this.#bootstrap;
    }
    // TODO: consider moving bootstrap token resolution into the codec.
    return this.#codec.build({ '@': token });
  }

  protected build(value: unknown): unknown {
    return this.#codec.build(value as WireEncoding);
  }

  protected recognize(value: unknown): unknown {
    return this.#codec.recognize(value);
  }

  private makeIssuerKit(name: string) {
    const kit = createIssuerKit({
      db: this.#db,
      commodity: { namespace: 'COMMODITY', mnemonic: name },
      makeGuid: this.#makeGuid,
      nowMs: this.#nowMs,
    });
    this.#codec.registerKit(kit);
    const { issuer, brand, mint } = kit;
    return freeze({ issuer, brand, mint });
  }

  // uses default bootstrapModule from WebkeyRpcDurableObject
}

export class LedgerDurableObject extends LedgerDurableObjectBase {
  constructor(ctx: DurableObjectState, env: Env) {
    const randomUUID = crypto.randomUUID.bind(crypto);
    const makeToken = () => randomUUID().replace(/-/g, '');
    const makeGuid = () => asGuid(randomUUID().replace(/-/g, ''));
    super(ctx, env, { makeToken, makeGuid, nowMs: () => Date.now() });
  }
}
