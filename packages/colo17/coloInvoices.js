const Colo = {
  sheet: 'Expenses',
  queryRange: 'coloInvoiceQuery',
  hd: [
    'Date',
    'Message Id',
    'From',
    'Subject',
    'Item #',
    'Description',
    'Amount',
  ],
};

function tableRecord_($) {
  const { fromEntries } = Object;

  const [hd, detail] = $('tr', 'table');
  const td = [...$('td', detail)];
  const entries = [...$('th', hd)].map((th, col) => {
    return [$(th).text(), $(td[col]).text()];
  })

  return fromEntries(entries);
}

function messageDetail_(m) {
  const $ = Cheerio.load(m.getBody());
  const detail = tableRecord_($);

  return [
    m.getDate(),
    m.getId(),
    m.getFrom(),
    m.getSubject(),
    detail['Item #'],
    detail['Description'],
    detail['Amount'],
  ];
}

function LoadColoInvoices() {
  console.warn('AMBIENT: SpreadsheetApp');
  const doc = SpreadsheetApp.getActive();
  const sheet = doc.getSheetByName(Colo.sheet);

  const query = doc.getRangeByName(Colo.queryRange).getValue();
  console.warn('AMBIENT: GmailApp');
  const threads = GmailApp.search(query);
  const rows = [];
  threads.forEach(thread =>
    thread.getMessages().forEach((m, ix) => {
      if (ix > 0) {
        console.warn('more than 1 thread in message', m);
        return;
      };
      const values = messageDetail_(m);
      rows.push(values);
    }),
  );
  sheet.clear();
  setRange(sheet, Colo.hd, rows);
}
