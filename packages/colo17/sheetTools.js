function setRange(sheet, hd, rows, hdRow = 1, detailRow = hdRow + 1) {
  sheet.getRange(hdRow, 1, 1, hd.length).setValues([hd]);
  sheet.getRange(detailRow, 1, rows.length, hd.length).setValues(rows);
}
