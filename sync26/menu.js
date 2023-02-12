// cribbed from : https://developers.google.com/apps-script/guides/menus

function onOpen() {
  console.warn('AMBIENT: SpreadsheetApp');
  const ui = SpreadsheetApp.getUi();

  // Or DocumentApp or FormApp.
  ui.createMenu('Family Finances')
      .addSubMenu(ui.createMenu('Lunch Money')
        .addItem('Load Txs', 'loadLunchMoneyTransactions')
        .addItem('Save Txs', 'saveLunchMoneyTransactions'))
      .addSeparator()
      .addSubMenu(ui.createMenu('Venmo')
          .addItem('Load Receipts', 'loadVenmoReceipts')
          .addItem('Update Tx from Receipt', 'UpdateTransactionDetailsFromReceipts')
          )
      .addToUi();
}
