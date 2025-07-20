function doGet(e) {
  const sheetId = e.parameter.sheetId;
  if (!sheetId) {
    return createJsonResponse({ error: "sheetId parameter required" });
  }
  
  try {
    const file = DriveApp.getFileById(sheetId);
    const modifiedTime = file.getLastUpdated().toISOString();
    return createJsonResponse({ modifiedTime });
  } catch (error) {
    return createJsonResponse({ error: error.toString() });
  }
}

function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}