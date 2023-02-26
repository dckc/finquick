// cribbed from : https://developers.google.com/apps-script/guides/menus
// also: https://developers.google.com/apps-script/guides/sheets/functions

function onOpen() {
  console.warn('AMBIENT: SpreadsheetApp');
  const ui = SpreadsheetApp.getUi();

  // Or DocumentApp or FormApp.
  ui.createMenu('Family Finances')
    .addItem('Tx Lookup', 'TxLookup')
    .addItem('Load Trade Accounting', 'loadTradeAccountingMessages')
    .addSubMenu(
      ui
        .createMenu('Lunch Money')
        .addItem('Load Txs', 'loadLunchMoneyTransactions')
        .addItem('Save Txs', 'saveLunchMoneyTransactions'),
    )
    .addSeparator()
    .addSubMenu(
      ui
        .createMenu('Venmo')
        .addItem('Load Receipts', 'LoadVenmoReceipts')
        .addItem(
          'Update Tx from Receipt',
          'UpdateTransactionDetailsFromReceipts',
        ),
    )
    .addToUi();
}

function TxLookup() {
  const { values } = Object;

  console.warn('AMBIENT: SpreadsheetApp');
  const active = SpreadsheetApp.getActive();

  const sel = active.getSelection();
  const range = sel.getActiveRange();
  const sheet = range.getSheet();
  const cols = sheet.getLastColumn();
  const [hd] = sheet.getRange(1, 1, 1, cols).getValues();
  const rowNum = range.getRow();
  const rec = getRowRecord(sheet, rowNum, hd);

  let edits;
  switch (rec.Description.replace(/^Pending ~ /, '')) {
    case 'Amazon':
      edits = AmazonLookup(rec);
      break;
    case 'Venmo':
      edits = VenmoLookup(rec);
      break;
    default:
      SpreadsheetApp.getUi().alert(
        `${sheet.getName()}: row ${rowNum} ???: ${values(rec)}`,
      );
      return;
  }
  // SpreadsheetApp.getUi()
  //   .alert(`${sheet.getName()}:${rowNum}: ${JSON.stringify(edits)}`);
  updateRecord(sheet, hd, rowNum, edits);
}
