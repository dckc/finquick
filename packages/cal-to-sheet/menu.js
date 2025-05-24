/**
 * Adds a custom menu to the spreadsheet.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Calendar Sync')
    .addItem('Update from Calendar', 'updateSheetFromCalendar')
    .addToUi();
}
