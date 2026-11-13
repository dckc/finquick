// @ts-check
// menu.js: the owner's side, a Webkeys menu in the spreadsheet this
// script is bound to. The Webkeys sheet is the capability table: the
// sheet lists the webkeys, and deleting a row (or its id) revokes one.
//
// mintSelectedRow starts with asOwner_() in its body; see web.js for
// why not in a default.

/**
 * Any visitor can call a menu function through google.script.run,
 * running as the owner; then the active user is anonymous ('').
 *
 * @param {object} io
 * @param {Pick<GoogleAppsScript.Base.Session, 'getActiveUser' | 'getEffectiveUser'>} [io.session]
 */
function asOwner_({ session = Session } = {}) {
  const me = session.getEffectiveUser().getEmail();
  if (!me || session.getActiveUser().getEmail() !== me) throw Error('owner only');
}

/**
 * @param {unknown} _e
 * @param {{ ui?: GoogleAppsScript.Base.Ui }} io
 */
function onOpen(_e, { ui = SpreadsheetApp.getUi() } = {}) {
  ui.createMenu('Webkeys').addItem('Mint webkey for selected row', 'mintSelectedRow').addToUi();
}

/**
 * Give the selected row of the Webkeys sheet a webkey, and show it once.
 * Without a Webkeys sheet, make one.
 *
 * @param {unknown} _nonce
 * @param {object} io
 * @param {GoogleAppsScript.Base.Ui} [io.ui]
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} [io.doc]
 * @param {GoogleAppsScript.Utilities.Utilities} [io.utilities]
 * @param {(s: string) => number[]} [io.digest]
 * @param {() => string} [io.random]
 * @param {() => Date} [io.now]
 * @param {GoogleAppsScript.Properties.Properties} [io.props]
 * @param {string | null} [io.webAppUrl] the deployment's /exec URL; not
 *   ScriptApp.getService().getUrl(), which can name another deployment
 * @param {GoogleAppsScript.HTML.HtmlService} [io.html]
 */
function mintSelectedRow(_nonce, {
  ui = SpreadsheetApp.getUi(),
  doc = SpreadsheetApp.getActive(),
  utilities = Utilities,
  digest = s => utilities.computeDigest(utilities.DigestAlgorithm.SHA_256, s, utilities.Charset.UTF_8),
  random = () => (utilities.getUuid() + utilities.getUuid()).replace(/-/g, ''), // v4 UUIDs: 244 random bits
  now = () => new Date(),
  props = PropertiesService.getScriptProperties(),
  webAppUrl = props.getProperty('webAppUrl'),
  html = HtmlService,
} = {}) {
  asOwner_();
  if (!webAppUrl) throw Error("Set script property webAppUrl to the deployment's /exec URL.");
  const sheet = doc.getSheetByName(WEBKEYS.sheetName);
  if (!sheet) {
    doc.insertSheet(WEBKEYS.sheetName).appendRow([...WEBKEYS.hd]);
    ui.alert(`Made a ${WEBKEYS.sheetName} sheet. Put a Gmail query and a note in a row, select it, and mint again.`);
    return;
  }
  const selected = doc.getActiveRange();
  if (!selected || selected.getSheet().getName() !== WEBKEYS.sheetName || selected.getNumRows() !== 1) {
    throw Error(`Select one row of the ${WEBKEYS.sheetName} sheet.`);
  }
  props.setProperty('spreadsheet', doc.getId()); // where the web app finds the table
  const { swiss } = makeMinter_({ sheet, digest, random, now }).mint(selected.getRow());
  const page = html.createTemplate(
    '<p>Copy this webkey; it is not shown again.</p>' +
      '<textarea readonly rows="5" style="width:100%" onclick="this.select()"><?= webkey ?></textarea>',
  );
  page.webkey = `${webAppUrl}#s=${swiss}`;
  ui.showModalDialog(page.evaluate().setWidth(520).setHeight(220), 'Webkey');
}
