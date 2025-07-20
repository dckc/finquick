function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function doGet(e) {
  const { sheetId } = e.parameter;
  if (!sheetId) {
    return createJsonResponse({ error: 'sheetId parameter required' });
  }

  try {
    const file = DriveApp.getFileById(sheetId);
    const modifiedTime = file.getLastUpdated().toISOString();
    return createJsonResponse({ modifiedTime });
  } catch (error) {
    return createJsonResponse({ error: error.toString() });
  }
}

// Test functions for use with Google Apps Script debugger
function _testDoGet() {
  console.log('Testing doGet with missing sheetId...');
  const resultMissing = doGet({ parameter: {} });
  console.log('Result:', resultMissing.getContent());

  console.log('Testing doGet with invalid sheetId...');
  const resultInvalid = doGet({ parameter: { sheetId: 'invalid-id' } });
  console.log('Result:', resultInvalid.getContent());

  // Note: To test with a valid sheet ID, replace 'your-test-sheet-id'
  // with an actual Google Sheets ID you have access to
  console.log('Testing doGet with valid sheetId (uncomment to test)...');
  // const resultValid = doGet({ parameter: { sheetId: 'your-test-sheet-id' } });
  // console.log('Result:', resultValid.getContent());
}

function _testCreateJsonResponse() {
  console.log('Testing createJsonResponse...');
  const testData = { test: 'value', timestamp: new Date().toISOString() };
  const response = createJsonResponse(testData);
  console.log('Response content:', response.getContent());
  console.log('Response MIME type:', response.getMimeType());
}
