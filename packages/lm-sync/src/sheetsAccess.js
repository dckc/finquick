// @ts-check

// based on
// https://github.com/Agoric/testnet-notes/blob/main/subm/src/sheetAccess.js
// 8dbbe50 on Dec 23, 2021

/**
 * @param {GoogleSpreadsheetWorksheet} sheet
 * @param {string | number} key
 * @throws on not found
 */
const lookup = async (sheet, key) => {
  // load primary key column
  // @ts-expect-error types are wrong?
  await sheet.loadCells({
    startColumnIndex: 0,
    endColumnIndex: 1,
  });

  let rowIndex = 1;
  for (; rowIndex < sheet.rowCount; rowIndex += 1) {
    const { value } = sheet.getCell(rowIndex, 0);
    if (value === null) throw RangeError(`${key}`); // empty row: end of data
    if (key === value) {
      break;
    }
  }
  if (rowIndex === sheet.rowCount) throw RangeError(`${key}`);
  const [row] = await sheet.getRows({ offset: rowIndex - 1, limit: 1 });
  if (!row) throw TypeError('should not happen');
  return row;
};

/**
 * @param {GoogleSpreadsheetWorksheet} sheet
 * @param {string | number} key
 * @param {Record<string, string | number>} record
 * @typedef {import('google-spreadsheet').GoogleSpreadsheetWorksheet} GoogleSpreadsheetWorksheet
 */
const upsert = async (sheet, key, record) => {
  let row;
  try {
    row = await lookup(sheet, key);
  } catch (_notFound) {
    // ignore
  }
  if (row) {
    Object.assign(row, record);
    // @ts-expect-error types are wrong?
    // docs clearly show a raw option
    // https://theoephraim.github.io/node-google-spreadsheet/#/classes/google-spreadsheet-row?id=fn-save
    await row.save({ raw: true });
  } else {
    row = await sheet.addRow(record);
  }
  return row;
};

/** @param {string} message */
const fail = message => {
  throw Error(message);
};

/**
 * @param {Record<string, string | undefined>} env
 * @returns {Record<string, string>}
 */
const makeConfig = env =>
  /** @ts-expect-error cast */
  new Proxy(env, {
    get(_t, name, _r) {
      if (typeof name !== 'string') throw RangeError(String(name));
      const out = env[name] || fail(`missing ${String(name)}`);
      return out;
    },
    set(_t, _p, _v) {
      throw Error('read-only');
    },
  });

/**
 * @param {string[]} _argv
 * @param {Record<string, string | undefined>} env
 * @param {Object} io
 * @param {typeof import('fs/promises')} io.fsp
 * @param {typeof import('google-spreadsheet').GoogleSpreadsheet} io.GoogleSpreadsheet
 */
const integrationTest = async (_argv, env, { fsp, GoogleSpreadsheet }) => {
  const config = makeConfig(env);
  const creds = await fsp
    .readFile(config.PROJECT_CREDS, 'utf-8')
    .then(s => JSON.parse(s));

  // Initialize the sheet - doc ID is the long id in the sheets URL
  const doc = new GoogleSpreadsheet(env.SHEET1_ID);

  // Initialize Auth - see https://theoephraim.github.io/node-google-spreadsheet/#/getting-started/authentication
  await doc.useServiceAccountAuth(creds);

  await doc.loadInfo(); // loads document properties and worksheets

  const sheet = doc.sheetsByIndex[0]; // or use doc.sheetsById[id] or doc.sheetsByTitle[title]
  console.log({
    doc: { title: doc.title },
    sheet0: { title: sheet.title, rowCount: sheet.rowCount },
  });

  //   await upsert(sheet, '358096357862408195', {
  //     userID: '358096357862408195',
  //     email: 'dckc@agoric.com',
  //   });
};

/* global require, process */
if (require.main === module) {
  integrationTest(
    process.argv.slice(2),
    { ...process.env },
    {
      fsp: require('fs/promises'),
      // eslint-disable-next-line global-require
      GoogleSpreadsheet: require('google-spreadsheet').GoogleSpreadsheet, // please excuse CJS
    },
  ).catch(err => console.error(err));
}

/* global module */
module.exports = { lookup, upsert };
