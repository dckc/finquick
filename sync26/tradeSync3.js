const tradeAccountingQuery = 'has:attachment from:me trade accounting';


const headings2 = {
  Trading: ['Date', 'Message Id', 'Subject', 'Attachments'],
  StakeTax: ['timestamp'],
  Osmosis: ['status'],
  Coinbase: ['Timestamp'],
};

function reset_(active) {
  for (const name of Object.keys(headings2)) {
    const sheet = active.getSheetByName(name);
    console.log('clear sheet:', name)
    sheet.clear();
  }
}

function findHd_(rows) {
  for (let ix = 0; ix < rows.length; ix++) {
    for (const [name, [col1]] of Object.entries(headings2)) {
      if (rows[ix][0] === col1) {
        return [name, rows[ix], rows.slice(ix + 1)];
      }
    }
  }
  throw Error(`cannot recognize header: ${rows[0]}`)
}

function loadCSV_(active, att) {
  const rows = Utilities.parseCsv(att.getDataAsString());
  const [name, hd, detail] = findHd_(rows);

  const sheet = active.getSheetByName(name);
  sheet.getRange(1, 1, 1, hd.length).setValues([hd]);
  const last = sheet.getLastRow();
  console.log('loading', detail.length, 'rows from', att.getName(), 'into', name, 'at', last);
  sheet.getRange(last + 1, 1, detail.length, hd.length).setValues(detail);
}

function loadTradeAccountingMessages() {
  console.warn('AMBIENT: SpreadsheetApp');
  const active = SpreadsheetApp.getActive();
  reset_(active);

  const sheet = active.getSheetByName('trading');

  const hd = headings2.Trading;
  sheet.getRange(1, 1, 1, hd.length).setValues([hd]);

  console.warn('AMBIENT: GmailApp');
  const threads = GmailApp.search(tradeAccountingQuery);
  const msgs = threads.flatMap(thread => thread.getMessages().filter((m, ix) => ix <= 1));

  const rows = msgs.map((m, ix) => {
    const subject = m.getSubject();
    // const body = m.getBody();
    const atts = m.getAttachments();

    const row = [m.getDate(), m.getId(), subject, atts.length];
    console.log('Message:', row);

    atts.forEach(att => loadCSV_(active, att));

    return row;
  });
  sheet.getRange(2, 1, rows.length, hd.length).setValues(rows);
}
