/**
 * @file SettlementFacet consolidates multi-transaction ERTP settlements
 * into proper GnuCash stock-trade transactions.
 *
 * Like ChartFacet names accounts, SettlementFacet handles GnuCash-specific
 * transaction formatting without polluting ERTP logic.
 *
 * @see ./chart.ts for the analogous pattern with accounts
 */

import type { SqlDatabase } from './sql-db.js';
import type { Guid } from './types.js';

const { freeze } = Object;

export type SettlementResult<T> = Readonly<{
  result: T;
  settlementRef: string;
  txGuid?: string;
}>;

export type SettlementFacet = Readonly<{
  settle: <T>(
    operation: () => Promise<T>,
    description?: string,
  ) => Promise<SettlementResult<T>>;
}>;

/**
 * Create a settlement facet that consolidates ERTP settlements into
 * proper GnuCash stock-trade transactions.
 *
 * ERTP escrow creates separate transactions per commodity. SettlementFacet
 * folds them into one transaction with proper value/quantity splits:
 * - Value is in currency terms (the transaction currency)
 * - Quantity is in account commodity terms
 *
 * @param db - Database connection
 * @param currencyGuid - GUID of the currency commodity (used as transaction currency)
 * @param makeSettlementRef - Factory for settlement reference numbers
 */
export const makeSettlementFacet = ({
  db,
  currencyGuid,
  makeSettlementRef,
}: {
  db: SqlDatabase;
  currencyGuid: Guid;
  makeSettlementRef: () => string;
}): SettlementFacet => {
  const getMaxTxGuid = () => {
    const row = db
      .prepare<[], { max_guid: string | null }>(
        'SELECT MAX(guid) as max_guid FROM transactions',
      )
      .get();
    return row?.max_guid ?? '';
  };

  return freeze({
    settle: async <T>(
      operation: () => Promise<T>,
      description?: string,
    ): Promise<SettlementResult<T>> => {
      const settlementRef = makeSettlementRef();
      const beforeGuid = getMaxTxGuid();
      const result = await operation();

      // Find transactions created during operation
      const newTxs = db
        .prepare<[string], { guid: string; currency_guid: string }>(
          'SELECT guid, currency_guid FROM transactions WHERE guid > ?',
        )
        .all(beforeGuid);

      if (newTxs.length < 2) {
        // Nothing to consolidate
        return freeze({ result, settlementRef, txGuid: newTxs[0]?.guid });
      }

      // Currency transaction is the survivor
      const currencyTx = newTxs.find(tx => tx.currency_guid === currencyGuid);
      const otherTxs = newTxs.filter(tx => tx.guid !== currencyTx?.guid);

      if (!currencyTx) {
        throw new Error('No currency transaction found to consolidate into');
      }

      // Get the exchange rate from the currency transaction
      // (sum of positive values = total currency amount in the trade)
      const currencyTotal = db
        .prepare<[string], { total: string }>(
          `SELECT SUM(value_num) as total FROM splits
           WHERE tx_guid = ? AND value_num > 0`,
        )
        .get(currencyTx.guid);
      const currencyAmount = BigInt(currencyTotal?.total ?? '0');

      // Sanity check: only consolidate cleared transactions (no live payments)
      const txGuids = newTxs.map(tx => tx.guid);
      const [firstTxGuid, ...restTxGuids] = txGuids;
      const pendingSplits = db
        .prepare<[string, ...string[]], { count: number }>(
          `SELECT COUNT(*) as count FROM splits
           WHERE tx_guid IN (${newTxs.map(() => '?').join(',')})
           AND reconcile_state != 'c'`,
        )
        .get(firstTxGuid, ...restTxGuids);
      if (pendingSplits && pendingSplits.count > 0) {
        throw new Error('Cannot consolidate: found pending (non-cleared) splits');
      }

      // Move splits from other transactions, updating value to currency terms
      for (const tx of otherTxs) {
        // Get the commodity amount (sum of positive quantities)
        const commodityTotal = db
          .prepare<[string], { total: string }>(
            `SELECT SUM(quantity_num) as total FROM splits
             WHERE tx_guid = ? AND quantity_num > 0`,
          )
          .get(tx.guid);
        const commodityAmount = BigInt(commodityTotal?.total ?? '1');

        // Exchange rate: how much currency per commodity unit
        const rate = currencyAmount / commodityAmount;

        // Update splits: value = quantity * rate (in currency terms)
        db.prepare(
          `UPDATE splits SET
             tx_guid = ?,
             value_num = quantity_num * ?,
             value_denom = quantity_denom
           WHERE tx_guid = ?`,
        ).run(currencyTx.guid, rate.toString(), tx.guid);

        db.prepare('DELETE FROM transactions WHERE guid = ?').run(tx.guid);
      }

      // Mark the consolidated transaction
      if (description) {
        db.prepare(
          'UPDATE transactions SET num = ?, description = ? WHERE guid = ?',
        ).run(settlementRef, description, currencyTx.guid);
      } else {
        db.prepare('UPDATE transactions SET num = ? WHERE guid = ?').run(
          settlementRef,
          currencyTx.guid,
        );
      }

      return freeze({ result, settlementRef, txGuid: currencyTx.guid });
    },
  });
};
