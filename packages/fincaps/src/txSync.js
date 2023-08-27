// @ts-check
import { E, Far } from '@endo/far';

/** @template T @typedef {import('@endo/far').ERef<T>} ERef */

// I goofed during Sheetsync setup.
// TODO: make this a parameter.
const txTitle = 'Transactions (2)';

/**
 * Match Syncsheets transactions with GnuCash.
 *
 * For each row that does not yet have a tx_guid,
 * look it up in split_detail by date, amount, and account code.
 * Update tx_guid and online_id in Syncsheets.
 *
 * update sheets.Transactions dest
 * set dest.tx_guid = x.tx_guid
 *   , dest.online_id = x.online_id
 * from (
 *   select dest.rowNum, src.tx_guid, src.online_id
 *   from sheets.Transactions dest
 *   join gnucash.split_detail src
 *   on src.date = dest.date
 *   and src.amount = dest.amount
 *   and src.code = dest.code
 *   where dest.tx_guid is null
 * ) x where x.rowNum = dest.rowNum
 *
 * @param {ERef<import("./sheetsTool").Spreadsheet>} sc Sheetsync "ORM"
 * @param {ERef<import("./dbTool").DBTool>} gc GnuCash "ORM"
 * @param {object} pageOptions
 * @param {number} [pageOptions.offset]
 * @param {number} [pageOptions.limit]
 */
export const pushTxIds = async (sc, gc, { offset, limit = 3000 } = {}) => {
  const txSheet = E(sc).getSheetByTitle(txTitle);
  const acctSheet = E(sc).getSheetByTitle('Accounts');
  const txs = await E(txSheet).getRows(offset, limit);

  //   const sample = {
  //     first: txs[0]._rawData,
  //     last: txs.at(-1)?._rawData,
  //   };
  console.log('Sheetsync txs:', txs.length);
  let modified = 0;

  for (const tx of txs) {
    if (tx.tx_guid >= '') continue;
    const { ['Account #']: acctNum, ['Account']: acctName } = tx;
    const acct = await E(acctSheet)
      .select1({
        'Account #': acctNum,
        Account: acctName,
      })
      .then(it => E(it).get());
    const detail = E(
      E(E(gc).getTable('split_detail')).query({
        post_date: tx.Date,
        amount: Number(tx.Amount.replace(/[,$]/g, '')),
        code: acct.code,
      }),
    ).get();
    if (detail) {
      //   console.log('found split:', detail);
      const edits = {
        tx_guid: detail.tx_guid,
        ...(detail.online_id ? { online_id: detail.online_id } : {}),
      };
      console.log('@@sc.update', ['Transactions', tx.rowIndex - 1, edits]);
      modified += 1;
    }
  }
  console.log('modified:', modified, { limit, offset });
  if (modified > 0) {
    console.log('@@@', `await sc.commit('Transactions')`);
  }
  return modified;
};

export const make = () => Far('SyncTool', { pushTxIds });
