// @ts-check
import { createHash } from 'crypto';
import { asPromise } from './asPromise';
import { check } from './check';

const { freeze, fromEntries } = Object;

/** @type {(text: string) => Record<string, string>} */
function sqlStatements(text) {
  /** @type {Record<string, string>} */
  const byName = {};
  /** @type {(lo: number, hi: number) => string} */
  const chop = (lo, hi) => text.substring(lo, hi).replace(/;\s*$/, '');
  let pos = 0;
  let name;
  for (const m of text.matchAll(/^-- (?<name>[^:]+):\n/gm)) {
    if (name) {
      byName[name] = chop(pos, m.index || -1);
    }
    pos = m.index || -1;
    name = check.notNull(m.groups).name;
  }
  if (name && pos < text.length) {
    byName[name] = chop(pos, text.length);
  }
  return byName;
}

/**
 * @typedef {{
 *   update<T>(dml: string, t: T, params?: unknown[]): Promise<void>;
 *   commit(): Promise<void>;
 *   rollback(): Promise<void>;
 * }} Transaction<T>
 * @template T
 */

/**
 * @param {{
 *   exec: <T>(dml: string, out: T, params?: unknown[]) => Promise<T>
 *   close: () => Promise<void>,
 *   process: { pid: number, hostname: () => string },
 * }} io
 *
 * @typedef {{ changes: number, lastInsertRowId: unknown }} RunInfo
 */
function DBwrap({ exec, close, process }) {
  /**
   * @returns {Promise<Transaction<T>>}
   * @template T
   *
   * TODO: factor gnclock logic out of DB
   */
  async function begin() {
    const rollback = () =>
      exec('rollback', {}).then(_r => exec('delete from gnclock', undefined));
    const mkTx = () =>
      freeze({
        async update(d, o, p) {
          try {
            await exec(d, o, p);
          } catch (error) {
            rollback();
            throw error;
          }
        },
        async commit() {
          await exec('commit', {});
          await exec('delete from gnclock', {});
        },
        rollback,
      });

    const locks = await exec('select hostname, pid from gnclock', [
      { hostname: '', pid: 0 },
    ]);
    if (locks.length > 0) {
      console.log('locked!', locks, 'we are', process.pid);
      const l = locks[0];
      if (l.pid === process.pid) {
        return mkTx();
      }
      const p = `process ${l.pid} on ${l.hostname}`;
      throw `Database locked by ${p}`;
    }

    await exec(
      `insert into gnclock (Hostname, Pid)
                        values (?, ?)`,
      null,
      [process.hostname(), process.pid],
    );
    await exec('begin', null);
    return mkTx();
  }
  /** @type {RunInfo} */
  const runInfo = /**@type {any} */ (undefined);

  return freeze({
    /** @type { (sql: string, params?: unknown[]) => Promise<RunInfo> } */
    exec: (sql, params) => exec(sql, runInfo, params),
    query: exec,
    begin,
    close,
  });
}

/**
 * @param {{
 *   connect: () => Promise<Connection>
 *   process: { pid: number, hostname: () => string },
 * }} io
 */
const DB = ({ connect, process }) => {
  async function reconnect() {
    const conn = await connect();
    conn.on('error', err => {
      console.log(err);
      connP = reconnect();
    });
    return conn;
  }
  let connP = reconnect();

  /**
   * @param {string} dml
   * @param {T} _outType
   * @param {unknown[]=} params
   * @returns {Promise<T>}
   * @template T
   */
  async function exec(dml, _outType, params) {
    const c = await connP;
    // console.log('DEBUG: db.query: ', dml, params || '');

    return new Promise((resolve, reject) =>
      c.query(dml, params, (err, rows) => {
        if (err) {
          console.log('SQL error: ', c.format(dml, params || []));
          return reject(err);
        }
        // console.log('DEBUG: db.query result: ',
        //             dml, params, rows);
        resolve(rows);
      }),
    );
  }

  function close() {
    return connP.then(c => {
      asPromise(cb => c.end(err => cb(err, null)));
    });
  }

  return DBwrap({ exec, close, process });
};

/**
 * @param {{
 *   connect: () => SqliteDB
 *   process: { pid: number, hostname: () => string },
 * }} io
 *
 * @typedef {import('better-sqlite3').Database} SqliteDB
 */
export const DBsqlite = ({ connect, process }) => {
  const db = connect();
  db.pragma('journal_mode = WAL');
  db.function('md5', content =>
    createHash('md5').update(content).digest('hex'),
  );

  /**
   * @param {string} dml
   * @param {T} outSample
   * @param {unknown[][]=} params
   * @returns {Promise<T>}
   * @template T
   */
  async function exec(dml, outSample, params) {
    return new Promise((resolve, reject) => {
      console.log('DEBUG:', outSample ? 'query:' : 'exec:', dml, outSample);
      const stmt = db.prepare(dml);

      if (outSample) {
        try {
          const rows = stmt.all(...(params || []));
          // @ts-ignore caller is responsible for type-safety
          resolve(rows);
        } catch (err) {
          reject(err);
        }
        return;
      }

      try {
        let changes = 0;
        if (Array.isArray(params)) {
          for (const binding of params) {
            const info = stmt.run(...binding);
            changes += info.changes;
          }
        } else {
          stmt.run();
        }
        // @ts-ignore caller is responsible for type-safety
        resolve({ changes });
      } catch (err) {
        reject(err);
      }
    });
  }

  function close() {
    return Promise.resolve().then(() => {
      db.close();
    });
  }

  return DBwrap({ exec, close, process });
};

/**
 * @typedef {{
 *   tx_date: string,
 *   description?: string,
 *   amount?: number,
 *   memo?: string,
 *   memo_acct?: string,
 *   tx_guid: string,
 *   acct_path?: string,
 *   code?: string,
 *   online_id: string,
 * }} Tx
 */
/** @type { Tx } */
const TX_EXAMPLE = {
  tx_date: '2020-08-21',
  description: 'PRICE CHOPPER #119 OVERLAND PARK',
  amount: 7.23,
  memo: '',
  memo_acct: 'GOOGLE PAY ENDING IN 6059',
  tx_guid: '56845dc213c10cd5931b20a5df45df0e',
  acct_path: 'Current:CC:Discover',
  online_id: 'FITID20200823-7.23QXO6B',
};

/**
 * GnuCash Book
 *
 * @param {ReturnType<typeof DB>} db
 * @param { (specifier: string) => string } requireText
 * @typedef {import('mysql').Connection} Connection
 */
export function GCBook(db, requireText) {
  const sql = sqlStatements(requireText('./book_ops.sql'));

  return freeze({
    /**
     * Uncategorized transactions
     *
     * @returns {Promise<Record<string, Tx>>}
     */
    async unCat() {
      const txs = await db.query(sql.uncat, [TX_EXAMPLE]);
      const byGuid = fromEntries(txs.map(tx => [tx.tx_guid, tx]));
      return byGuid;
    },
    /**
     * @param {{ UPDATE: Tx[] }} info
     */
    async update({ UPDATE }) {
      console.log('updating', UPDATE.length);
      await Promise.all(
        UPDATE.map(({ tx_guid, code }) =>
          db
            .begin()
            .then(tx =>
              tx.update(sql.updateSplitAccounts, undefined, [code, tx_guid]),
            ),
        ),
      );
      return UPDATE.length;
    },
    /**
     * @param {string} name
     * @param {{ id: string, data: unknown }[]} records
     */
    async importSlots(name, records) {
      console.log('importing', records.length, name, 'slots');
      if (!records.length) return;
      await db.exec(sql.dropSlotImport);
      await db.exec(sql.createSlotImport);
      await db.exec(
        sql.loadSlotImport,
        records.map(({ id, data }) => [id, name, JSON.stringify(data)]),
      );
      const inserted = await db.exec(sql.insertSlotImport);
      console.log('inserted', inserted.changes);
      const updated = await db.exec(sql.updateSlotImport);
      console.log('updated', updated.changes);
    },
    exec: db.exec,
    close: db.close,
  });
}
