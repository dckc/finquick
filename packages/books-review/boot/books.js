/**
 * A GnuCash book, loaded once into the vat's own database from a
 * sqlite-diffable dump (`<table>.metadata.json` and `<table>.ndjson` per
 * table) in a git tree.
 *
 * What the vat keeps about the load is in its zone, not a table, so none of
 * its own tables can clash with one in the dump. A dump's table may not be
 * named for the vat's (`vatstore`), SQLite's (`sqlite_`), or Cloudflare's
 * (`_cf_`), and a table that already exists is refused, as
 * `sqlite-diffable load` refuses it.
 *
 * Once loaded, the vat hands out a view of the book, for other vats: it
 * reads the accounts, and the splits in uncategorized accounts (by account
 * code: Imbalance, typically `9001`), with where splits like them went
 * before.
 */
/**
 * @import { CastedPattern, TypeFromInterfaceGuard, TypeFromPattern } from '@endo/patterns';
 * @import { BuildRootObject, MapStore, Powers, Remote } from '@vattr/toybox/src/types.ts';
 * @import { GitTree } from '../devices.ts';
 * @import { Guid, IsoDate } from '../types.ts';
 */

const METADATA = /\.metadata\.json$/;
const NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
const RESERVED = /^(vatstore$|sqlite_|_cf_)/i;

/** GnuCash's indexes, which a dump lacks, and one for finding precedents by description. */
const INDEXES = [
  'CREATE INDEX IF NOT EXISTS tx_post_date_index ON transactions(post_date)',
  'CREATE INDEX IF NOT EXISTS splits_tx_guid_index ON splits(tx_guid)',
  'CREATE INDEX IF NOT EXISTS splits_account_guid_index ON splits(account_guid)',
  'CREATE INDEX IF NOT EXISTS slots_guid_index ON slots(obj_guid)',
  'CREATE INDEX IF NOT EXISTS tx_description_index ON transactions(upper(trim(description)))',
];

/** @param {string} name */
const quote = name => `"${name}"`;

/** Where a load keeps a table until the whole dump is in: no dump's table can be named so, since NAME starts with a letter. @param {string} name */
const staged = name => `_staged_${name}`;

/** A value as sqlite-diffable dumps it: no blobs, and no integer JSON can't hold exactly. @param {unknown} v */
const isCell = v =>
  v === null ||
  typeof v === 'string' ||
  (typeof v === 'number' && (!Number.isInteger(v) || Number.isSafeInteger(v)));

/** @typedef {{ guid: Guid, name: string, type: AccountType, code: string, placeholder: number, hidden: number }} AccountRow */
/** @typedef {{ split: Guid, tx_guid: Guid, account_guid: Guid, date: IsoDate, description: string, amount: number }} SplitRow */
/** @typedef {{ name: string, columns: string[], schema: string, data: string | undefined }} DumpTable */

/** Whether a split may go to the account `a`: income or expense, neither a placeholder nor hidden. @param {AccountRow | undefined} a */
const isCategory = a =>
  !!a && ['INCOME', 'EXPENSE'].includes(a.type) && !a.placeholder && !a.hidden;

/**
 * A table's metadata from a dump, checked: a name a dump may use, columns,
 * and one CREATE TABLE statement for that name.
 *
 * @param {string} path
 * @param {unknown} meta
 * @returns {{ name: string, columns: string[], schema: string }}
 */
export const checkMetadata = (path, meta) => {
  const { name, columns, schema } = /** @type {Record<string, unknown>} */ (
    meta
  );
  if (typeof name !== 'string' || !NAME.test(name) || RESERVED.test(name))
    throw Error(`${path}: a table may not be named ${JSON.stringify(name)}`);
  if (
    !Array.isArray(columns) ||
    !columns.every(c => typeof c === 'string' && NAME.test(c))
  )
    throw Error(`${path}: bad columns`);
  if (
    typeof schema !== 'string' ||
    schema.includes(';') ||
    !new RegExp(`^CREATE TABLE [\\["]?${name}[\\]"]?\\s*\\(`, 'i').test(schema)
  )
    throw Error(
      `${path}: the schema must be one CREATE TABLE ${name} statement`,
    );
  return { name, columns, schema };
};

/**
 * The shapes of the book's records, and the view's guard, made from the
 * `M` a vat is given. The records' types are inferred from them, below,
 * so the guard checks what the types say; types.ts exports them.
 *
 * Brands are claims a pattern can't check: a guid is a string, which a
 * lookup checks names something; a date, one the book's post_date
 * starts with.
 *
 * @param {Powers['M']} M
 */
export const makeShapes = M => {
  const GuidShape = /** @type {CastedPattern<Guid>} */ (M.string());
  const IsoDateShape = /** @type {CastedPattern<IsoDate>} */ (M.string());
  /** GnuCash's account types, as its accounts table has them. */
  const AccountTypeShape = M.or(
    'ROOT',
    'ASSET',
    'BANK',
    'CASH',
    'CREDIT',
    'LIABILITY',
    'STOCK',
    'MUTUAL',
    'CURRENCY',
    'INCOME',
    'EXPENSE',
    'EQUITY',
    'RECEIVABLE',
    'PAYABLE',
    'TRADING',
  );
  /**
   * An account in the book, by its full name (`Expenses:Groceries`);
   * `category` if a split may go to it: an income or expense account
   * that isn't a placeholder.
   */
  const AccountShape = harden({
    guid: GuidShape,
    name: M.string(),
    type: AccountTypeShape,
    code: M.string(),
    category: M.boolean(),
  });
  /**
   * Where a split's money came from or went: another account in its
   * transaction; its type `?` for an account the book doesn't have.
   */
  const AgainstShape = harden({
    name: M.string(),
    type: M.or(AccountTypeShape, '?'),
  });
  /** A split as the book's view describes it. */
  const SplitShape = harden({
    split: GuidShape,
    date: IsoDateShape,
    description: M.string(),
    amount: M.number(),
    against: M.arrayOf(AgainstShape),
  });
  /** Where splits of transactions with one description went before: an account by its full name. */
  const PrecedentShape = harden({
    account: M.string(),
    count: M.number(),
    last: IsoDateShape,
  });
  /** How many splits are uncategorized, and the dates of the first and last. */
  const SummaryShape = harden({
    count: M.number(),
    first: M.or(IsoDateShape, null),
    last: M.or(IsoDateShape, null),
  });
  const ViewI = M.interface('View', {
    accounts: M.call().returns(M.arrayOf(AccountShape)),
    uncategorized: M.call().returns(M.arrayOf(SplitShape)),
    precedents: M.call(M.string()).returns(M.arrayOf(PrecedentShape)),
    split: M.call(GuidShape).returns(
      harden({ ...SplitShape, uncategorized: M.boolean() }),
    ),
    summary: M.call().returns(SummaryShape),
  });
  return harden({
    GuidShape,
    AccountTypeShape,
    AccountShape,
    AgainstShape,
    SplitShape,
    PrecedentShape,
    SummaryShape,
    ViewI,
  });
};
/** @typedef {ReturnType<typeof makeShapes>} Shapes */
/** @typedef {TypeFromPattern<Shapes['AccountTypeShape']>} AccountType */
/** @typedef {TypeFromPattern<Shapes['AccountShape']>} Account */
/** @typedef {TypeFromPattern<Shapes['AgainstShape']>} Against */
/** @typedef {TypeFromPattern<Shapes['SplitShape']>} Split */
/** @typedef {TypeFromPattern<Shapes['PrecedentShape']>} Precedent */
/** @typedef {TypeFromPattern<Shapes['SummaryShape']>} Summary */
/** @typedef {TypeFromInterfaceGuard<Shapes['ViewI']>} View the book, to read */

/**
 * @typedef {object} Params
 * @property {Remote<GitTree>} tree a git tree holding the dump
 * @property {string[]} [uncategorized] the codes of the accounts whose splits need a category
 */

/** @satisfies {BuildRootObject<Params>} */
export const buildRootObject = (
  { E, Far, M, zone, db },
  { tree, uncategorized: codes = ['9001'] },
) => {
  /** @type {MapStore<'tables', string[]>} what the vat keeps about its book: its tables */
  const book = zone.mapStore('book');
  const loaded = () => {
    if (!book.has('tables')) throw Error('no book is loaded yet');
  };

  /** @type {import('@vattr/toybox/src/types.ts').SqlStatement<[], AccountRow>} */
  const accountRows = db.prepare(
    `WITH RECURSIVE path(guid, name, type, code, placeholder, hidden) AS (
       SELECT a.guid, a.name, a.account_type, a.code, a.placeholder, a.hidden FROM accounts a JOIN books b ON a.parent_guid = b.root_account_guid
       UNION ALL
       SELECT a.guid, path.name || ':' || a.name, a.account_type, a.code, a.placeholder, path.hidden OR a.hidden FROM accounts a JOIN path ON a.parent_guid = path.guid
     ) SELECT * FROM path`,
  );
  /** Each account, with its full name, by guid; template accounts excluded. */
  const accounts = () => new Map(accountRows.all().map(row => [row.guid, row]));
  /** @param {Map<string, AccountRow>} byGuid */
  const uncategorizedAccounts = byGuid =>
    [...byGuid.values()]
      .filter(a => codes.includes(a.code ?? ''))
      .map(a => a.guid);
  /** @type {import('@vattr/toybox/src/types.ts').SqlStatement<[string], SplitRow>} */
  const splitRow = db.prepare(
    `SELECT s.guid AS split, s.tx_guid, s.account_guid, substr(t.post_date, 1, 10) AS date, t.description, s.value_num * 1.0 / s.value_denom AS amount
     FROM splits s JOIN transactions t ON t.guid = s.tx_guid WHERE s.guid = ?`,
  );
  /** @type {import('@vattr/toybox/src/types.ts').SqlStatement<[Guid, Guid], { account_guid: Guid }>} */
  const others = db.prepare(
    'SELECT account_guid FROM splits WHERE tx_guid = ? AND guid != ?',
  );
  /**
   * A split as the view describes it. `against` is where the money came
   * from or went: the transaction's other accounts, by name and
   * GnuCash type (`BANK`, `CREDIT`, ...).
   *
   * @param {Map<string, AccountRow>} byGuid
   * @param {SplitRow} row
   * @returns {Split}
   */
  const describe = (byGuid, row) =>
    harden({
      split: row.split,
      date: row.date,
      description: row.description,
      amount: row.amount,
      against: others.all(row.tx_guid, row.split).map(o => {
        const a = byGuid.get(o.account_guid);
        /** @type {Against} */
        const against = {
          name: a?.name ?? o.account_guid,
          type: a?.type ?? '?',
        };
        return against;
      }),
    });
  /** @type {import('@vattr/toybox/src/types.ts').SqlStatement<[string], { account_guid: Guid, count: number, last: IsoDate }>} */
  const precedentRows = db.prepare(
    `SELECT s.account_guid, count(*) AS count, max(substr(t.post_date, 1, 10)) AS last
     FROM splits s JOIN transactions t ON t.guid = s.tx_guid
     WHERE upper(trim(t.description)) = upper(trim(?)) GROUP BY s.account_guid ORDER BY count DESC, last DESC`,
  );
  /** Each split in an uncategorized account, oldest first. @param {Map<string, AccountRow>} byGuid */
  const uncategorizedSplits = byGuid => {
    const from = uncategorizedAccounts(byGuid);
    /** @type {import('@vattr/toybox/src/types.ts').SqlStatement<Guid[], { guid: Guid }>} */
    const q = db.prepare(
      `SELECT s.guid FROM splits s JOIN transactions t ON t.guid = s.tx_guid WHERE s.account_guid IN (${from.map(() => '?').join(', ')}) ORDER BY t.post_date`,
    );
    return q.all(...from).map(r => r.guid);
  };
  /** How many splits are uncategorized, and the dates of the first and last. @param {Map<string, AccountRow>} byGuid */
  const uncategorizedSummary = byGuid => {
    const from = uncategorizedAccounts(byGuid);
    /** @type {import('@vattr/toybox/src/types.ts').SqlStatement<Guid[], { count: number, first: IsoDate | null, last: IsoDate | null }>} */
    const q = db.prepare(
      `SELECT count(*) AS count, min(substr(t.post_date, 1, 10)) AS first, max(substr(t.post_date, 1, 10)) AS last
       FROM splits s JOIN transactions t ON t.guid = s.tx_guid WHERE s.account_guid IN (${from.map(() => '?').join(', ')})`,
    );
    const row = q.get(...from);
    return harden({
      count: row?.count ?? 0,
      first: row?.first ?? null,
      last: row?.last ?? null,
    });
  };
  /** @param {string} guid */
  const mustGetSplit = guid => {
    const row = splitRow.get(guid);
    if (!row) throw Error(`no split ${JSON.stringify(guid)}`);
    return row;
  };

  const { ViewI } = makeShapes(M);
  /** @type {View} the guard's types, so the methods agree with what it checks */
  const viewMethods = {
    /** Every account; `category` if a split may go to it. */
    accounts() {
      loaded();
      return harden(
        [...accounts().values()].map(
          /** @returns {Account} */ a => ({
            guid: a.guid,
            name: a.name,
            type: a.type,
            code: a.code ?? '',
            category: isCategory(a),
          }),
        ),
      );
    },
    /** The splits in uncategorized accounts, oldest first. */
    uncategorized() {
      loaded();
      const byGuid = accounts();
      return harden(
        uncategorizedSplits(byGuid).map(guid =>
          describe(byGuid, mustGetSplit(guid)),
        ),
      );
    },
    /**
     * Where splits of transactions with this description (case and
     * surrounding space aside) went before: income and expense accounts,
     * most used first.
     */
    precedents(description) {
      loaded();
      const byGuid = accounts();
      return harden(
        precedentRows
          .all(description)
          .filter(r => isCategory(byGuid.get(r.account_guid)))
          .map(r => ({
            account: /** @type {AccountRow} */ (byGuid.get(r.account_guid))
              .name,
            count: r.count,
            last: r.last,
          })),
      );
    },
    /** How many splits are uncategorized, and the dates of the first and last. */
    summary() {
      loaded();
      return uncategorizedSummary(accounts());
    },
    /** The split `guid`, and whether it is uncategorized. */
    split(guid) {
      loaded();
      const byGuid = accounts();
      const row = mustGetSplit(guid);
      return harden({
        ...describe(byGuid, row),
        uncategorized: uncategorizedAccounts(byGuid).includes(row.account_guid),
      });
    },
  };
  const makeView = zone.exoClass('View', ViewI, () => ({}), viewMethods);
  const view = zone.makeOnce('view', () => makeView());

  /** The lines of the file at `path`, read a chunk at a time. @param {string} path */
  async function* lines(path) {
    const reader = await E(tree).open(path);
    let rest = '';
    for (let r = await E(reader).next(); !r.done; r = await E(reader).next()) {
      const parts = (rest + (r.value ?? '')).split('\n');
      rest = parts.pop() ?? '';
      yield* parts;
    }
    if (rest) yield rest;
  }

  /** @type {import('@vattr/toybox/src/types.ts').SqlStatement<[string], { 1: number }>} */
  const exists = db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
  );

  /** The tables of the dump in `dir`, each checked before any is made. @param {string} dir */
  const readDump = async dir => {
    /** @type {string[]} */
    const paths = await E(tree).list();
    /** @type {DumpTable[]} */
    const tables = [];
    for (const path of paths.filter(
      p => p.startsWith(`${dir}/`) && METADATA.test(p),
    )) {
      const meta = JSON.parse(await E(tree).read(path));
      // SQLite keeps it, and inserting explicit ids brings it up to date
      if (meta?.name === 'sqlite_sequence') continue;
      const { name, columns, schema } = checkMetadata(path, meta);
      if (exists.get(name)) throw Error(`table ${name} already exists`);
      const data = path.replace(METADATA, '.ndjson');
      tables.push({
        name,
        columns,
        schema,
        data: paths.includes(data) ? data : undefined,
      });
    }
    if (!tables.length) throw Error(`${dir}: no dump's tables there`);
    return tables;
  };

  /** Fill the staged table for `t` from its data file. @param {DumpTable} t */
  const fill = async ({ name, columns, data }) => {
    if (!data) return;
    const insert = db.prepare(
      `INSERT INTO ${quote(staged(name))} (${columns.map(quote).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    );
    let n = 0;
    for await (const line of lines(data)) {
      if (!line.trim()) continue;
      n += 1;
      const row = JSON.parse(line);
      if (
        !Array.isArray(row) ||
        row.length !== columns.length ||
        !row.every(isCell)
      )
        throw Error(
          `${data} row ${n}: not ${columns.length} strings, safe numbers, or nulls`,
        );
      insert.run(...row);
    }
  };

  return Far('books', {
    /**
     * Load the dump in the tree's directory `dir`, once: all of it, or,
     * if any table or row is refused, none of it.
     *
     * @param {string} dir
     */
    async load(dir) {
      if (book.has('tables')) throw Error("this vat's book is already loaded");
      const tables = await readDump(dir);
      // what a load cut short by a crash left behind
      /** @type {import('@vattr/toybox/src/types.ts').SqlStatement<[], { name: string }>} */
      const leftovers = db.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '\\_staged\\_%' ESCAPE '\\'",
      );
      for (const { name } of leftovers.all())
        db.exec(`DROP TABLE ${quote(name)}`);
      /** @type {string[]} */
      const made = [];
      try {
        for (const t of tables) {
          db.exec(
            t.schema.replace(
              /^CREATE TABLE [["]?\w+[\]"]?/i,
              `CREATE TABLE ${quote(staged(t.name))}`,
            ),
          );
          made.push(t.name);
          /** @type {import('@vattr/toybox/src/types.ts').SqlStatement<[], { name: string }>} */
          const info = db.prepare(
            `PRAGMA table_info(${quote(staged(t.name))})`,
          );
          const actual = info.all().map(c => c.name);
          if (actual.join() !== t.columns.join())
            throw Error(
              `${t.name} has columns ${actual.join()}, not ${t.columns.join()}`,
            );
          await fill(t);
        }
      } catch (e) {
        for (const name of made)
          db.exec(`DROP TABLE IF EXISTS ${quote(staged(name))}`);
        throw e;
      }
      // the reader said done only once the files matched the tree: now the whole book appears at once
      db.transaction(() => {
        for (const name of made)
          db.exec(
            `ALTER TABLE ${quote(staged(name))} RENAME TO ${quote(name)}`,
          );
        if (made.includes('splits'))
          for (const index of INDEXES) db.exec(index);
        book.init('tables', harden(made));
      });
      return harden(made);
    },
    /** Each loaded table's number of rows, by name. */
    tables() {
      const names = book.has('tables') ? book.get('tables') : [];
      return harden(
        Object.fromEntries(
          names.map(name => {
            /** @type {import('@vattr/toybox/src/types.ts').SqlStatement<[], { n: number }>} */
            const count = db.prepare(
              `SELECT count(*) AS n FROM ${quote(name)}`,
            );
            return [name, count.get()?.n ?? 0];
          }),
        ),
      );
    },
    getView: () => view,
    /** Each account's balance, in hundredths, by name. */
    balances() {
      /** @type {import('@vattr/toybox/src/types.ts').SqlStatement<[], { name: string, balance: number }>} */
      const rows = db.prepare(
        'SELECT a.name, sum(s.value_num * 100 / s.value_denom) AS balance FROM splits s JOIN accounts a ON a.guid = s.account_guid GROUP BY a.guid ORDER BY a.name',
      );
      return harden(
        Object.fromEntries(
          rows.all().map(({ name, balance }) => [name, balance]),
        ),
      );
    },
  });
};
/** @typedef {ReturnType<typeof buildRootObject>} Books the vat's root */
