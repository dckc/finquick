const tradeAccountingQuery = 'has:attachment from:me trade accounting';


const headings2 = {
  Trading: ['Message Id', 'Date', 'Attachments', 'Subject'],
  StakeTax: ['timestamp'],
  Osmosis: ['status', 'time'],
  Coinbase: ['Timestamp'],
};

const fixDates = {
  StakeTax: ([t, ...rest]) => [Utilities.parseDate(t, 'GMT', "yyyy-MM-dd' 'HH:mm:ss"), ...rest],
  Osmosis: ([s, t, ...rest]) => [s, Utilities.parseDate(t, 'GMT', "yyyy/MM/dd' 'HH:mm:ss"), ...rest],
  Coinbase: ([t, ...rest]) => [Utilities.parseDate(t, 'GMT', "yyyy-MM-dd'T'HH:mm:ss'Z'"), ...rest],
};

const filterSince = {
  StakeTax: since => ([t]) => t >= since,
  Osmosis: since => ([s, t]) => s === 'success' && t >= since,
  Coinbase: since => ([t]) => t >= since,
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

function loadCSV_(active, att, since) {
  const rows = Utilities.parseCsv(att.getDataAsString());
  const [name, hd, raw] = findHd_(rows);
  const detail = raw.map(fixDates[name]).filter(filterSince[name](since));

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

  const since = active.getRangeByName('tradesSince').getValue();
  const rows = msgs.map((m, ix) => {
    const subject = m.getSubject();
    // const body = m.getBody();
    const atts = m.getAttachments();

    const row = [m.getId(), m.getDate(), atts.length, subject];
    console.log('Message:', row);

    atts.forEach(att => loadCSV_(active, att, since));

    return row;
  });
  sheet.getRange(2, 1, rows.length, hd.length).setValues(rows);
}
