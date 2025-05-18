const die = msg => {
  throw Error(msg);
};
const NonNullish = (x, msg) => x || die(msg);

function getCalendarEventUrl(calendarId, eventId) {
  return `https://calendar.google.com/calendar/event?cid=${calendarId}&eid=${eventId}`;
}

/**
 * Updates the spreadsheet with events from the specified Google Calendar.
 */
function updateSheetFromCalendar(_nonce, io = {}) {
  const {
    // Get the spreadsheet and sheet
    ss = SpreadsheetApp.getActiveSpreadsheet(),
    sheet = ss.getActiveSheet() || ss.getSheets()[0],
    sheetName = sheet.getName(),
    // Get the calendar
    calendar = NonNullish(
      CalendarApp.getCalendarsByName(sheetName),
      `cannot find calendar ${sheetName}`,
    )[0],
    // Get today's date (for the start of the query)
    today = new Date(),
    ui = SpreadsheetApp.getUi(),
  } = io;

  const calendarId = calendar.getId();

  const firstRow = 1; // The first row to write data to (header row assumed above)
  const clearExistingData = true; // Set to true to clear existing data before updating

  today.setHours(0, 0, 0, 0); // Start of the day

  // Get events from the calendar (you can adjust the date range as needed)
  const events = calendar.getEvents(
    today,
    new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000),
  ); // Events for the next year

  // Prepare data for the sheet
  const eventData = events.map(event => [
    event.getTitle(),
    event.getStartTime(),
    event.getEndTime(),
    event.getLocation(),
    event.getDescription(),
    getCalendarEventUrl(calendarId, event.getId()),
  ]);

  // Clear existing data if specified
  if (clearExistingData && sheet.getLastRow() > 0) {
    sheet
      .getRange(firstRow, 1, sheet.getLastRow(), sheet.getLastColumn())
      .clearContent();
  }

  // Write the event data to the sheet
  if (eventData.length > 0) {
    sheet
      .getRange(firstRow, 1, eventData.length, eventData[0].length)
      .setValues(eventData);

    // Add headers if the sheet was empty or cleared
    if (clearExistingData || sheet.getLastRow() === 0) {
      sheet.insertRowBefore(firstRow);
      sheet
        .getRange(firstRow, 1, 1, 6)
        .setValues([
          [
            'Title',
            'Start Time',
            'End Time',
            'Location',
            'Description',
            'Calendar Link',
          ],
        ]);
      sheet.getRange(firstRow, 1, 1, 6).setFontWeight('bold');
    }
  } else {
    ui.alert(
      'Info',
      'No events found in the specified calendar for the given date range.',
      SpreadsheetApp.Ui.ButtonSet.OK,
    );
  }
}
