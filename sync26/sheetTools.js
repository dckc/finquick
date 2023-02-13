

function GetAllSheetNames() {
  console.warn('AMBIENT: SpreadsheetApp');
  const sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  return sheets.map(sheet => sheet.getName());
}

function setRange(sheet, hd, rows, hdRow = 1, detailRow = hdRow + 1) {
  sheet.getRange(hdRow, 1, 1, hd.length).setValues([hd]);
  sheet.getRange(detailRow, 1, rows.length, hd.length).setValues(rows);
}

const zip = (xs, ys) => xs.map((x, ix) => [x, ys[ix]]);

function getRowRecord(sheet, row, headings) {
  const [values] = sheet.getRange(row, 1, 1, headings.length).getValues();
  const entries = zip(headings, values);
  return Object.fromEntries(entries);
}

function getSheetRecords(sheet) {
  const hd = [];
  for (let col = 1, name; (name = sheet.getRange(1, col).getValue()) > ''; col += 1) {
    hd.push(name);
  }
  const data = sheet.getRange(2, 1, sheet.getLastRow(), hd.length).getValues();
  const records = [];
  for (const values of data) {
    const entries = zip(hd, values)
    const record = Object.fromEntries(entries);
    if (!record[hd[0]]) break;
    records.push(record);
  }
  return { hd, records };
}

function updateRecord(sheet, hd, row, record) {
  for (const [name, value] of Object.entries(record)) {
    const col = hd.findIndex(h => h === name) + 1;
    sheet.getRange(row, col).setValues([[value]]);
  }
}

const DAY = 24 * 60 * 60 * 1000;
function daysBetween(start, end) {
  const dur = end.getTime() - start.getTime();
  return Math.floor(dur / DAY);
}
