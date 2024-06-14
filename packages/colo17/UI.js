// cribbed from : https://developers.google.com/apps-script/guides/menus
// also: https://developers.google.com/apps-script/guides/sheets/functions

function onOpen() {
  console.warn('AMBIENT: SpreadsheetApp');
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('MadMode')
    .addItem('Load Colo Invoices', 'LoadColoInvoices')
    .addToUi();
    // .addSubMenu(
    //   ui
    //     .createMenu('Lunch Money')
    //     .addItem('Load Txs', 'loadLunchMoneyTransactions')
    //     .addItem('Save Txs', 'saveLunchMoneyTransactions'),
    // )
}

function LoadColoInvoices() {
  console.warn('AMBIENT: SpreadsheetApp');
  SpreadsheetApp.getUi()
     .alert('TODO');
}