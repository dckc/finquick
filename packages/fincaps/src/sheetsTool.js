// @ts-check
import { E, Far } from '@endo/far';
import * as sheetsAmbient from 'google-spreadsheet';

const zip = (xs, ys) => xs.map((x, i) => [x, ys[i]]);

const { fromEntries } = Object;

/** @param {sheetsAmbient.GoogleSpreadsheetWorksheet} sheet */
const makeWorksheet = sheet => {
  const rd = Far('WorksheetRd', {
    readOnly: () => rd,
    getRows: async (offset = 0, limit = 100) => {
      /** @type {sheetsAmbient.WorksheetGridRange} */
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

      const { headerValues } = sheet;
      return rows.map(row => fromEntries(zip(headerValues, row._rawData)));
    },
  });

  const wr = Far('WorksheetWr', { ...rd });

  return wr;
};

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
      const creds = JSON.parse(credTxt);
      const doc = new GoogleSpreadsheet(id);
      await doc.useServiceAccountAuth(creds);
      await doc.loadInfo();
      return makeSpreadsheet(doc);
    },
  });
};
