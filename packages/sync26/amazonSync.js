/** @file
 *
 * Look up Sheetsync transactions from Amazon Order History
 *
 * Expected format is from
 *
 *  - [Amazon Order History
 *    Reporter](https://chrome.google.com/webstore/detail/amazon-order-history-repo/mgkilgclilajckgnedgjgnfdokkgnibi)
 *   Version 1.9.28 Updated June 19, 2023
 *  - https://github.com/philipmulcahy/azad d4db890 on Jun 19
 *
 * Note:
 *
 *  - [Amazon Order History Reports ending March 20, 2023 :
 *    r/DataHoarder](https://www.reddit.com/r/DataHoarder/comments/11kbuta/amazon_order_history_reports_ending_march_20_2023/)
 */

const Amazon = {
  sheetName: 'Amazon CSV',
};

function AmazonLookup(tx) {
  console.warn('AMBIENT: SpreadsheetApp');
  const doc = SpreadsheetApp.getActive();

  const { records: orders } = getSheetRecords(
    doc.getSheetByName(Amazon.sheetName),
  );
  const sameAmount = orders.filter(o => o.total === -tx.Amount);
  const ok = sameAmount.filter(o => {
    const delta = daysBetween(o.date, tx.Date);
    return delta >= 0 && delta <= 3;
  });
  // console.log('amount and date', ok)
  if (ok.length < 1) {
    throw Error(`no matches`);
  }
  if (ok.length > 1) {
    throw Error(`too many matches: ${ok.length}`);
  }
  const [it] = ok;

  const memo = JSON.stringify([it.items, { orderId: it['order id'] }]);
  const edits = { memo };
  console.log(tx.Date, tx.Amount, edits);
  return edits;
}

function testAmazonLookup(rowNum = 31) {
  console.warn('AMBIENT: SpreadsheetApp');
  const active = SpreadsheetApp.getActive();

  const sheet = active.getSheetByName('Transactions (2)');
  const cols = sheet.getLastColumn();
  const [hd] = sheet.getRange(1, 1, 1, cols).getValues();
  const rec = getRowRecord(sheet, rowNum, hd);

  AmazonLookup(rec);
}
