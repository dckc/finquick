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
 * Once loaded, the vat hands out two facets of the book, for other vats:
 * a view, which reads it, and a mover, which can move a split out of an
 * uncategorized account (by account code: Imbalance, typically `9001`) into
 * an income or expense account, and nothing else. Each move goes in the
 * changelog, which an apply tool replays on the book the dump came from.
 */
/**
 * @import { BuildRootObject, MapStore, Remote, SqlDatabase } from '@vattr/toybox/types.ts';
 * @import { Account, Against, Change, Precedent, Split } from '../types.ts';
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

/** @typedef {{ guid: string, name: string, type: string, code: string, placeholder: number }} AccountRow */
/** @typedef {{ split: string, tx_guid: string, account_guid: string, date: string, description: string, amount: number }} SplitRow */
/** @typedef {{ name: string, columns: string[], schema: string, data: string | undefined }} DumpTable */

/** Whether a split may be moved to the account `a`: income or expense, and not a placeholder. @param {AccountRow | undefined} a */
const isCategory = a =>
  !!a && ['INCOME', 'EXPENSE'].includes(a.type) && !a.placeholder;

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
 * @typedef {object} Params
 * @property {Remote} tree a git tree holding the dump
 * @property {string[]} [uncategorized] the codes of the accounts whose splits need a category
 */

/** @type {BuildRootObject<Params>} */
export const buildRootObject = (
  { E, Far, M, zone, db },
  { tree, uncategorized: codes = ['9001'] },
) => {
  /** @type {MapStore<string, any>} what the vat keeps about its book: its tables, and how many changes */
  const book = zone.mapStore('book');
  /** @type {MapStore<number, Change>} by number */
  const changes = zone.mapStore('changes');
  const loaded = () => {
    if (!book.has('tables')) throw Error('no book is loaded yet');
  };

  /** @type {import('@vattr/toybox/types.ts').SqlStatement<[], AccountRow>} */
  const accountRows = db.prepare(
    `WITH RECURSIVE path(guid, name, type, code, placeholder) AS (
       SELECT a.guid, a.name, a.account_type, a.code, a.placeholder FROM accounts a JOIN books b ON a.parent_guid = b.root_account_guid
       UNION ALL
       SELECT a.guid, path.name || ':' || a.name, a.account_type, a.code, a.placeholder FROM accounts a JOIN path ON a.parent_guid = path.guid
     ) SELECT * FROM path`,
  );
  /** Each account, with its full name, by guid; template accounts excluded. */
  const accounts = () => new Map(accountRows.all().map(row => [row.guid, row]));
  /** @param {Map<string, AccountRow>} byGuid */
  const uncategorizedAccounts = byGuid =>
    [...byGuid.values()]
      .filter(a => codes.includes(a.code ?? ''))
      .map(a => a.guid);
  /** @type {import('@vattr/toybox/types.ts').SqlStatement<[string], SplitRow>} */
  const splitRow = db.prepare(
    `SELECT s.guid AS split, s.tx_guid, s.account_guid, substr(t.post_date, 1, 10) AS date, t.description, s.value_num * 1.0 / s.value_denom AS amount
     FROM splits s JOIN transactions t ON t.guid = s.tx_guid WHERE s.guid = ?`,
  );
  /** @type {import('@vattr/toybox/types.ts').SqlStatement<[string, string], { account_guid: string }>} */
  const others = db.prepare(
    'SELECT account_guid FROM splits WHERE tx_guid = ? AND guid != ?',
  );
  /**
   * A split as a reviewer or categorizer sees it. `against` is where the
   * money came from or went: the transaction's other accounts, by name and
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
  /** @type {import('@vattr/toybox/types.ts').SqlStatement<[string], { account_guid: string, count: number, last: string }>} */
  const precedentRows = db.prepare(
    `SELECT s.account_guid, count(*) AS count, max(substr(t.post_date, 1, 10)) AS last
     FROM splits s JOIN transactions t ON t.guid = s.tx_guid
     WHERE upper(trim(t.description)) = upper(trim(?)) GROUP BY s.account_guid ORDER BY count DESC, last DESC`,
  );
  /** Each split in an uncategorized account, oldest first. @param {Map<string, AccountRow>} byGuid */
  const uncategorizedSplits = byGuid => {
    const from = uncategorizedAccounts(byGuid);
    /** @type {import('@vattr/toybox/types.ts').SqlStatement<string[], { guid: string }>} */
    const q = db.prepare(
      `SELECT s.guid FROM splits s JOIN transactions t ON t.guid = s.tx_guid WHERE s.account_guid IN (${from.map(() => '?').join(', ')}) ORDER BY t.post_date`,
    );
    return q.all(...from).map(r => r.guid);
  };
  /** @param {string} guid */
  const mustGetSplit = guid => {
    const row = splitRow.get(guid);
    if (!row) throw Error(`no split ${JSON.stringify(guid)}`);
    return row;
  };

  const makeView = zone.exoClass(
    'View',
    M.interface('View', {
      accounts: M.call().returns(M.array()),
      uncategorized: M.call().returns(M.array()),
      precedents: M.call(M.string()).returns(M.array()),
      split: M.call(M.string()).returns(M.record()),
    }),
    () => ({}),
    {
      /** Every account; `category` if a split may be moved to it. */
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
       *
       * @param {string} description
       * @returns {Precedent[]}
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
      /** The split `guid`, and whether it is uncategorized. @param {string} guid */
      split(guid) {
        loaded();
        const byGuid = accounts();
        const row = mustGetSplit(guid);
        return harden({
          ...describe(byGuid, row),
          uncategorized: uncategorizedAccounts(byGuid).includes(
            row.account_guid,
          ),
        });
      },
    },
  );

  const makeMover = zone.exoClass(
    'Mover',
    M.interface('Mover', {
      move: M.call(M.string(), M.string()).returns(M.record()),
      changelog: M.call().returns(M.array()),
    }),
    () => ({}),
    {
      /**
       * Move the uncategorized split `split` to the income or expense
       * account `to`, and log the move in the changelog. The answer is the
       * logged change.
       *
       * @param {string} split
       * @param {string} to
       */
      move(split, to) {
        loaded();
        const byGuid = accounts();
        const row = splitRow.get(split);
        if (!row || !uncategorizedAccounts(byGuid).includes(row.account_guid))
          throw Error(`${JSON.stringify(split)} is not an uncategorized split`);
        if (!isCategory(byGuid.get(to)))
          throw Error(
            `${JSON.stringify(to)} is not an income or expense account`,
          );
        /** @type {Change} */
        const change = harden({
          table: 'splits',
          guid: split,
          column: 'account_guid',
          from: row.account_guid,
          to,
        });
        db.transaction(() => {
          db.prepare('UPDATE splits SET account_guid = ? WHERE guid = ?').run(
            to,
            split,
          );
          const n = book.has('changes') ? book.get('changes') + 1 : 1;
          if (book.has('changes')) book.set('changes', n);
          else book.init('changes', n);
          changes.init(n, change);
        });
        return change;
      },
      /** Every move made, in order, for an apply tool. */
      changelog() {
        return harden(
          changes
            .entries()
            .sort(([a], [b]) => a - b)
            .map(([, c]) => c),
        );
      },
    },
  );
  const view = zone.makeOnce('view', () => makeView());
  const mover = zone.makeOnce('mover', () => makeMover());

  /** The lines of the file at `path`, read a chunk at a time. @param {string} path */
  async function* lines(path) {
    const reader = await E(tree).open(path);
    let rest = '';
    for (let r = await E(reader).next(); !r.done; r = await E(reader).next()) {
      const parts = (rest + r.value).split('\n');
      rest = parts.pop() ?? '';
      yield* parts;
    }
    if (rest) yield rest;
  }

  /** @type {import('@vattr/toybox/types.ts').SqlStatement<[string], { 1: number }>} */
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
      /** @type {import('@vattr/toybox/types.ts').SqlStatement<[], { name: string }>} */
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
          /** @type {import('@vattr/toybox/types.ts').SqlStatement<[], { name: string }>} */
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
      /** @type {string[]} */
      const names = book.has('tables') ? book.get('tables') : [];
      return harden(
        Object.fromEntries(
          names.map(name => {
            /** @type {import('@vattr/toybox/types.ts').SqlStatement<[], { n: number }>} */
            const count = db.prepare(
              `SELECT count(*) AS n FROM ${quote(name)}`,
            );
            return [name, count.get()?.n ?? 0];
          }),
        ),
      );
    },
    getView: () => view,
    getMover: () => mover,
    /** Each account's balance, in hundredths, by name. */
    balances() {
      /** @type {import('@vattr/toybox/types.ts').SqlStatement<[], { name: string, balance: number }>} */
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
