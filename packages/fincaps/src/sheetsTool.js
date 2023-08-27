// @ts-check
import { E, Far } from '@endo/far';
import * as sheetsAmbient from 'google-spreadsheet';
import { JWT, auth } from 'google-auth-library';

const zip = (xs, ys) => xs.map((x, i) => [x, ys[i]]);

const { fromEntries } = Object;

/** @param {import('google-spreadsheet').GoogleSpreadsheetWorksheet} sheet */
const makeWorksheet = sheet => {
  // be sure to loadHeaderRow() first
  const toObj = row => fromEntries(zip(sheet.headerValues, row._rawData));

  /**
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

  const rd = Far('WorksheetRd', {
    readOnly: () => rd,
    find,
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

  const wr = Far('WorksheetWr', { ...rd });

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

  const wr = Far('SpreadsheetWr', { ...rd });

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
      const client = new JWT({
        email: keys.client_email,
        key: keys.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const doc = new GoogleSpreadsheet(id, client);
      await doc.loadInfo();
      return makeSpreadsheet(doc);
    },
  });
};
