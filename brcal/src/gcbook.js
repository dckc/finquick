// @ts-check
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

/**
 * GnuCash Book
 *
 * @param {Connection} conn
 * @param { (specifier: string) => string } requireText
 * @typedef {import('mysql').Connection} Connection
 */
export function GCBook(conn, requireText) {
  const sql = sqlStatements(requireText('./book_ops.sql'));
  const exec = (/** @type {string} */ sql, params = []) =>
    asPromise(cb => conn.query(sql, params, cb));

  return freeze({
    /**
     * Uncategorized transactions
     *
     * @returns {Promise<Record<string, Tx>>}
     */
    async unCat() {
      const txs = await exec(sql.uncat);
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
          exec(sql.updateSplitAccounts, [code, tx_guid]),
        ),
      );
      return UPDATE.length;
    },
    async close() {
      // @ts-ignore
      return asPromise(cb => conn.end(cb));
    },
  });
}
