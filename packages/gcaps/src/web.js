// @ts-check
// web.js: the web app's entry points, and where its authority comes from.
//
// Any visitor can call any global function declaration here or in
// menu.js, by way of google.script.run, running as the owner. A visitor
// can pass data but not functions, so it can't supply authority through
// the io defaults below; and a check never goes in a default, since a
// caller who passes that argument skips it. These defaults are the only
// code that names Apps Script's globals (ambient authority).

/** a page that reads its webkey from the fragment and lists the threads */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('page').setTitle('Mail query');
}

/**
 * POST { s, method, args } (as text/plain; the response comes by way of
 * a redirect) and get { ok } or { error }.
 *
 * @param {GoogleAppsScript.Events.DoPost} e
 * @param {object} io
 * @param {GoogleAppsScript.Utilities.Utilities} [io.utilities]
 * @param {(s: string) => number[]} [io.digest]
 * @param {(bytes: number[]) => string} [io.base64]
 * @param {GoogleAppsScript.Properties.Properties} [io.props]
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} [io.doc] where mint was (props: spreadsheet)
 * @param {WebkeysSheet | null} [io.sheet]
 * @param {GmailReader} [io.gmail]
 * @param {(query: string) => ReturnType<typeof makeMailQuery_>} [io.revive]
 */
function doPost(e, {
  utilities = Utilities,
  digest = s => utilities.computeDigest(utilities.DigestAlgorithm.SHA_256, s, utilities.Charset.UTF_8),
  base64 = bytes => utilities.base64Encode(bytes),
  props = PropertiesService.getScriptProperties(),
  doc = SpreadsheetApp.openById(props.getProperty('spreadsheet') || ''),
  sheet = doc.getSheetByName(WEBKEYS.sheetName),
  gmail = Gmail,
  revive = query => makeMailQuery_({ gmail, base64 }, query),
} = {}) {
  let reply;
  try {
    const { s, method, args = [] } = JSON.parse(e.postData.contents);
    reply = { ok: invoke_(makeCapTable_({ sheet, digest, revive }).lookup(s), method, args) };
  } catch (err) {
    reply = { error: err instanceof Error ? err.message : String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(reply)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * page.html's way in, by way of google.script.run: the same as doPost.
 *
 * @param {unknown} s
 * @param {unknown} method
 * @param {unknown} args
 * @param {object} io
 * @param {GoogleAppsScript.Utilities.Utilities} [io.utilities]
 * @param {(s: string) => number[]} [io.digest]
 * @param {(bytes: number[]) => string} [io.base64]
 * @param {GoogleAppsScript.Properties.Properties} [io.props]
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} [io.doc]
 * @param {WebkeysSheet | null} [io.sheet]
 * @param {GmailReader} [io.gmail]
 * @param {(query: string) => ReturnType<typeof makeMailQuery_>} [io.revive]
 */
function invoke(s, method, args, {
  utilities = Utilities,
  digest = s => utilities.computeDigest(utilities.DigestAlgorithm.SHA_256, s, utilities.Charset.UTF_8),
  base64 = bytes => utilities.base64Encode(bytes),
  props = PropertiesService.getScriptProperties(),
  doc = SpreadsheetApp.openById(props.getProperty('spreadsheet') || ''),
  sheet = doc.getSheetByName(WEBKEYS.sheetName),
  gmail = Gmail,
  revive = query => makeMailQuery_({ gmail, base64 }, query),
} = {}) {
  return invoke_(makeCapTable_({ sheet, digest, revive }).lookup(s), method, args || []);
}
