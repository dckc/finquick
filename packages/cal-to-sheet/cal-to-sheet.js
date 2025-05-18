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
function updateSheetFromCalendar() {
  // --- Configuration ---
  const calendarId = 'your_calendar_id@group.calendar.google.com'; // Replace with your calendar ID
  const sheetName = 'Calendar Events'; // Replace with the name of your sheet
  const firstRow = 1; // The first row to write data to (header row assumed above)
  const clearExistingData = true; // Set to true to clear existing data before updating

  // Get the spreadsheet and sheet
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    SpreadsheetApp.getUi().alert(
      'Error',
      `Sheet "${sheetName}" not found.`,
      SpreadsheetApp.Ui.ButtonSet.OK,
    );
    return;
  }

  // Get the calendar
  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) {
    SpreadsheetApp.getUi().alert(
      'Error',
      `Calendar with ID "${calendarId}" not found.`,
      SpreadsheetApp.Ui.ButtonSet.OK,
    );
    return;
  }

  // Get today's date (for the start of the query)
  const today = new Date();
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
    SpreadsheetApp.getUi().alert(
      'Info',
      'No events found in the specified calendar for the given date range.',
      SpreadsheetApp.Ui.ButtonSet.OK,
    );
  }
}
