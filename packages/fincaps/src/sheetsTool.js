// @ts-check
import { E, Far } from '@endo/far';
import * as sheetsAmbient from 'google-spreadsheet';
import { JWT, auth } from 'google-auth-library';

const zip = (xs, ys) => xs.map((x, i) => [x, ys[i]]);

const { entries, fromEntries } = Object;

/** @param {import('google-spreadsheet').GoogleSpreadsheetWorksheet} sheet */
const makeWorksheet = sheet => {
  // be sure to loadHeaderRow() first
  const toObj = row => fromEntries(zip(sheet.headerValues, row._rawData));

  /**
   * TODO@@@@
   * @param {string | number} key
   * @throws on not found
   */
  const find = async key => {
    // load primary key column
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
    return toObj(row);
  };

  let rowCache;
  const provideRows = async () => {
    if (rowCache) return rowCache;
    rowCache = await sheet.getRows().then(rows => rows.map(toObj));
    console.log('@@@', { rowCache });
    return rowCache;
  };

  const rd = Far('WorksheetRd', {
    readOnly: () => rd,

    getRows: async (offset = 0, limit = 100) => {
      await sheet.loadHeaderRow();

      const cellRange = {
        startRowIndex: (offset || 0) + 1, // skip header
        endRowIndex: (offset || 0) + (limit || 0) + 1, // + 1 for header
        startColumnIndex: 0,
        endColumnIndex: sheet.columnCount,
      };
      const [_cells, rows] = await Promise.all([
        sheet.loadCells(cellRange),
        sheet.getRows({ offset, limit }),
      ]);

      return rows.map(toObj);
    },
  });

  const wr = Far('WorksheetWr', {
    ...rd,
    readOnly: () => rd,
    /**
     * TODO: read-only select1
     * @param {Record<string, string | number>} keyFields
     */
    select1: async keyFields => {
      const rows = await provideRows();
      // match by string form
      const found = rows.filter(row =>
        entries(keyFields).every(([col, val]) => row[col] === `${val}`),
      );
      if (found.length !== 1)
        throw `found ${found.length} in ${
          sheet.title
        } matching ${JSON.stringify(keyFields)}`;
      const [it] = found;
      return Far('Row', {
        get: () => it,
        // TODO: transaction objects
        /** @param {Record<string, unknown>} dataFields */
        update: dataFields => Object.assign(it, dataFields),
      });
    },
  });

  return wr;
};

/** @typedef {ReturnType<typeof makeWorksheet>} Worksheet */

/** @param {sheetsAmbient.GoogleSpreadsheet} doc */
const makeSpreadsheet = doc => {
  const rd = Far('SpreadsheetRd', {
    title: () => doc.title,
    readOnly: () => rd,
    getSheetByTitle: title =>
      makeWorksheet(doc.sheetsByTitle[title]).readOnly(),
  });

  const wr = Far('SpreadsheetWr', {
    ...rd,
    readOnly: () => rd,
    getSheetByTitle: title => makeWorksheet(doc.sheetsByTitle[title]),
  });

  return wr;
};
/** @typedef {ReturnType<typeof makeSpreadsheet>} Spreadsheet */

export const make = () => {
  const { GoogleSpreadsheet } = sheetsAmbient;

  return Far('SheetsTool', {
    /** @param {import('./secret-tool').PassKey} item */
    load: async item => {
      const [{ id }, credTxt] = await Promise.all([
        E(item).properties(),
        E(item).get(),
      ]);
      assert.typeof(id, 'string');
      assert.typeof(credTxt, 'string');
      const keys = JSON.parse(credTxt);
      // ref https://github.com/googleapis/google-auth-library-nodejs/blob/v9.0.0/samples/jwt.js#L34
      const client = new JWT({
        email: keys.client_email,
        key: keys.private_key,
        // ref https://developers.google.com/sheets/api/scopes
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      // ref https://theoephraim.github.io/node-google-spreadsheet
      const doc = new GoogleSpreadsheet(id, client);
      await doc.loadInfo();
      return makeSpreadsheet(doc);
    },
  });
};
