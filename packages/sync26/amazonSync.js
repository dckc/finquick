
function AmazonLookup(tx) {
  console.warn('AMBIENT: SpreadsheetApp');
  const doc = SpreadsheetApp.getActive()

  const { records: orders } = getSheetRecords(doc.getSheetByName('Amazon Orders'));
  const sameAmount = orders.filter(o => o['Total Charged'] === -tx.Amount)
  const ok = sameAmount.filter(o => {
    const delta = daysBetween(o['Shipment Date'], tx.Date);
    return delta >= 0 && delta <= 3;
  });
  // console.log('amount and date', ok)
  if (ok.length < 1) {
    throw Error(`no matches`)
  }
  if (ok.length > 1) {
    throw Error(`too many matches: ${ok.length}`)
  }
  const [it] = ok;

  const { records: recentItems } = getSheetRecords(doc.getSheetByName('Amazon Items'));
  const txItems = recentItems.filter(item => item['Order ID'] === it['Order ID']);
  const titles = txItems.map(i => i.Title);
  const memo = JSON.stringify([titles, {orderId: it['Order ID']}])
  const edits = { memo }
  console.log(tx.Date, tx.Amount, edits);
  return edits;
}

function testAmazonLookup(rowNum = 78) {
  console.warn('AMBIENT: SpreadsheetApp');
  const active = SpreadsheetApp.getActive();

  const sheet = active.getSheetByName('Transactions (2)');
  const cols = sheet.getLastColumn()
  const [hd] = sheet.getRange(1, 1, 1, cols).getValues();
  const rec = getRowRecord(sheet, rowNum, hd);

  AmazonLookup(rec);
}
