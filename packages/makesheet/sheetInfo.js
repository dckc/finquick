/**
 * Creates a JSON response for the web app
 * @param {Object} data - The data to include in the JSON response
 * @returns {GoogleAppsScript.Content.TextOutput} The JSON response
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/**
 * Main web app handler that returns sheet modification timestamps
 * @param {GoogleAppsScript.Events.DoGet} e - The GET request event
 * @param {Object} io - Dependency injection object for testing
 * @param {Function} io.getFileById - Function to get file by ID (defaults to DriveApp.getFileById)
 * @returns {GoogleAppsScript.Content.TextOutput} JSON response with timestamp or error
 */
function doGet(e, io = {}) {
  const {
    getFileById = DriveApp.getFileById,
  } = io;

  const { sheetId } = e.parameter;
  if (!sheetId) {
    return createJsonResponse({ error: 'sheetId parameter required' });
  }

  try {
    const file = getFileById(sheetId);
    const modifiedTime = file.getLastUpdated().toISOString();
    return createJsonResponse({ modifiedTime });
  } catch (error) {
    return createJsonResponse({ error: error.toString() });
  }
}

// Test functions for use with Google Apps Script debugger
/**
 * Test function for doGet with various scenarios
 */
function _testDoGet() {
  console.log('Testing doGet with missing sheetId...');
  const resultMissing = doGet({ parameter: {} });
  console.log('Result:', resultMissing.getContent());

  console.log('Testing doGet with invalid sheetId...');
  const resultInvalid = doGet({ parameter: { sheetId: 'invalid-id' } });
  console.log('Result:', resultInvalid.getContent());

  console.log('Testing doGet with mock getFileById...');
  const mockFile = {
    getLastUpdated: () => new Date('2023-12-01T15:30:45.123Z'),
  };
  const mockIo = {
    getFileById: () => mockFile,
  };
  const resultMock = doGet({ parameter: { sheetId: 'test-id' } }, mockIo);
  console.log('Result:', resultMock.getContent());

  // Note: To test with a valid sheet ID, replace 'your-test-sheet-id'
  // with an actual Google Sheets ID you have access to
  console.log('Testing doGet with valid sheetId (uncomment to test)...');
  // const resultValid = doGet({ parameter: { sheetId: 'your-test-sheet-id' } });
  // console.log('Result:', resultValid.getContent());
}

/**
 * Test function for createJsonResponse
 */
function _testCreateJsonResponse() {
  console.log('Testing createJsonResponse...');
  const testData = { test: 'value', timestamp: new Date().toISOString() };
  const response = createJsonResponse(testData);
  console.log('Response content:', response.getContent());
  console.log('Response MIME type:', response.getMimeType());
}
