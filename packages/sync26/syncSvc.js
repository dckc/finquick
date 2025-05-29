/**
 * syncSvc -- HTTP handlers for synchronizing
 * GnuCash transactions with a Google Sheets in SheetSync format.
 *
 * @see {doPost} for pushing uncategorized transactions
 * @see {doGet} for pulling categories
 */
// @ts-check

// --- Configuration ---
const config = {
  sheetUncat: {
    name: 'GnuCash_Uncat',
    hd: ['date', 'description', 'amount', 'tx_guid', 'uploaded'],
  },
  /** Name of your SheetSync Transactions sheet */
  sheetTx: 'Transactions (2)',
  // see also getProperty(...) below
  idProp: 'GOOGLE_SHEET_ID',
};

/**
 * Expected format for the POST request body for `doPost`.
 */
const EXPECTED_POST_BODY_FORMAT = {
  transactions: [
    {
      guid: 'deadbeef...',
      date: '2020-01-02',
      description: 'payee etc.',
      amount: 123.45,
    },
  ],
};

/**
 * @typedef {typeof EXPECTED_POST_BODY_FORMAT} UncategorizedTransaction
 */

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string[]} hd
 * @param {(string|number|Date|boolean)[][]} rows
 * @param {number} [hdRow]
 * @param {number} [detailRow]
 */
function setRange(sheet, hd, rows, hdRow = 1, detailRow = hdRow + 1) {
  sheet.getRange(hdRow, 1, 1, hd.length).setValues([hd]);
  sheet.getRange(detailRow, 1, rows.length, hd.length).setValues(rows);
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string} name
 */
function getColumnNumber(sheet, name) {
  const [hd] = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues();
  const colIx = hd.indexOf(name);
  assert(colIx >= 0, `no such column: ${name}`);
  return colIx + 1;
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string} name
 */
function getColumn(sheet, name) {
  const column = getColumnNumber(sheet, name);
  const rows = sheet
    .getRange(2, column, sheet.getLastRow(), column)
    .getValues();
  return rows.map(([val]) => val);
}

/**
 * @param {unknown} requestBody
 * @param {object} io
 * @param {GoogleAppsScript.Spreadsheet.Sheet} io.sheetUncat
 * @param {() => number} io.now
 * @param {(...args: any[]) => void} [io.log]
 */
const saveUploaded = (
  requestBody,
  { sheetUncat, now, log = (...args) => {} },
) => {
  assert(requestBody);
  assert.typeof(requestBody, 'object');
  /** @type {UncategorizedTransaction['transactions']} */
  const uncategorizedTransactions = requestBody.transactions;

  if (
    !uncategorizedTransactions ||
    !Array.isArray(uncategorizedTransactions) ||
    uncategorizedTransactions.length === 0
  ) {
    throw Error('No transactions provided in the request body.');
  }

  log(
    `Received ${uncategorizedTransactions.length} uncategorized transactions from GnuCash.`,
  );

  const ts = new Date(now()); // Timestamp for when it was received

  const rows = uncategorizedTransactions.map(tx => [
    tx.date,
    tx.description,
    tx.amount,
    tx.guid,
    ts,
  ]);

  setRange(sheetUncat, config.sheetUncat.hd, rows);
  log(`Saved`, rows.length, `transactions to sheet`, sheetUncat.getName());
  return rows.length;
};

/**
 * Handles HTTP POST requests.
 * This function receives uncategorized transactions from the GnuCash extension.
 * It ONLY saves the transactions to the temporary sheet.
 *
 * Expected request body (JSON): {@link UncategorizedTransaction}
 *
 * @param {Pick<GoogleAppsScript.Events.DoPost, 'postData'>} e The event object from the POST request.
 * @returns {GoogleAppsScript.Content.TextOutput} A JSON response indicating success or failure.
 */
function doPost(e, io = {}) {
  try {
    const {
      now = Date.now,
      props = PropertiesService.getScriptProperties(),
      sheetId = NonNullish(
        props.getProperty(config.idProp),
        'GOOGLE_SHEET_ID not set in Project Properties.',
      ),
      spreadsheet = SpreadsheetApp.openById(sheetId),
      sheetUncat = spreadsheet.getSheetByName(config.sheetUncat.name),
    } = io;

    // Parse the JSON payload from the request body
    const requestBody = JSON.parse(e.postData.contents);
    assert(sheetUncat);
    const saved = saveUploaded(requestBody, { sheetUncat, now });
    return createJsonResponse({ code: 200, saved });
  } catch (error) {
    console.error('Error in doPost: ', error);
    return createJsonResponse({ code: 500, message: `Internal error.` });
  }
}

function doPostTest() {
  const contents = JSON.stringify(EXPECTED_POST_BODY_FORMAT);
  doPost({
    postData: { contents, length: contents.length, name: '?', type: '?/?' },
  });
}

/**
 * Handles HTTP GET requests.
 * This function returns a list of transaction GUIDs and their categories
 * from the Main Transactions sheet.
 *
 * @param {GoogleAppsScript.Events.DoGet} _e The event object from the GET request.
 * @param {object} [io]
 * @param {GoogleAppsScript.Properties.Properties} [io.props]
 * @param {string} [io.idProp]
 * @param {string} [io.sheetId]
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} [io.spreadsheet]
 * @param {GoogleAppsScript.Spreadsheet.Sheet} [io.sheetUncat]
 * @param {GoogleAppsScript.Spreadsheet.Sheet} [io.sheetTx]
 * @returns {GoogleAppsScript.Content.TextOutput} A JSON response containing categories.
 */
function doGet(_e, io = {}) {
  try {
    const {
      props = PropertiesService.getScriptProperties(),
      sheetId = NonNullish(
        props.getProperty(config.idProp),
        `no such project property: ${config.idProp}`,
      ),
      spreadsheet = SpreadsheetApp.openById(sheetId),
      sheetUncat = NonNullish(
        spreadsheet.getSheetByName(config.sheetUncat.name),
        `no such sheet: ${config.sheetUncat.name}`,
      ),
      sheetTx = NonNullish(
        spreadsheet.getSheetByName(config.sheetTx),
        `no such sheet: ${config.sheetTx}`,
      ),
    } = io;

    const uncatGuids = getColumn(sheetUncat, 'tx_guid').filter(g => g > '');
    const txData = sheetTx.getDataRange().getValues();
    const txHd = txData[0];
    const txRows = txData.slice(1);
    const guidIx = getColumnNumber(sheetTx, 'tx_guid') - 1;
    const wanted = txRows
      .filter(row => uncatGuids.includes(row[guidIx]))
      .map(([v0, dt, ...rest]) => [v0, dt.toISOString(), ...rest]);
    const result = { hd: txHd, rows: wanted };

    console.log({
      uncatGuids: uncatGuids.length,
      txRows: txRows.length,
      wanted: wanted.length,
    });
    return createJsonResponse({ code: 200, ...result });
  } catch (error) {
    console.error('Error in doGet: ', error);
    return createJsonResponse({ code: 500, message: `Internal error` });
  }
}

/**
 * Helper function to create a JSON response.
 * @param {object} data The data to include in the JSON response.
 * @returns {GoogleAppsScript.Content.TextOutput} A ContentService TextOutput object.
 */
function createJsonResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

const typeofToType = /** @type {const} */ ({
  undefined: undefined,
  boolean: true,
  number: 123,
  string: 'abc',
  object: /** @type {Record<any, any>|null} */ ({}),
});

/**
 * @type {((cond: unknown, msg?: string) => asserts cond) & {
 *   typeof: <K extends keyof typeof typeofToType
 *     >(specimen: unknown, ty: K, msg?: string) => asserts specimen is typeof typeofToType[K]
 * }}
 */
const assert = (() => {
  const a0 = (cond, msg) => {
    if (!cond) throw Error(msg || 'condition failed');
  };
  /**
   *
   * @template {keyof typeof typeofToType} K
   * @param {unknown} specimen
   * @param {K} ty
   * @param {string} [msg]
   * @returns {asserts specimen is typeof typeofToType[K]}
   */
  const ty = (specimen, ty, msg) => {
    const actual = typeof specimen;
    if (actual !== ty) throw Error(msg || `expected ${ty}; got ${actual}`);
  };
  const { assign, freeze } = Object;
  const it = assign(a0, { typeof: ty });
  freeze(it);
  return it;
})();

/**
 * @template T
 * @param {T | null | undefined} val
 * @param {string} [optDetails]
 * @returns {T}
 */
const NonNullish = (val, optDetails = `unexpected ${val}`) => {
  assert(val, optDetails);
  return val;
};
