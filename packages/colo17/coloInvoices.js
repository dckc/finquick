const Colo = {
  sheet: 'Expenses',
  queryRange: 'coloInvoiceQuery',
  hd: [
  'Date',
  'Message Id',
  'Subject',
  // 'Payee',
  // 'Amount',
  // 'Note',
  // 'Account',
  // 'Payment ID',
],
};

function messageDetail_(m) {
  const subject = m.getSubject();
  // const body = m.getBody();

  // const tx = maybeMatch(
  //   subject,
  //   /You (?:paid|completed) (?<payee>[^'\$]+)(?:'s )?\$(?<amount>[\d\.,]+)/,
  // );
  // if (!tx.amount) {
  //   console.warn('no amount??', subject);
  // }
  // const acct = maybeMatch(body, /(from|via) your (?<account>[^\.]+)/m).account;
  // const pmtId = maybeMatch(body, /Payment ID: (?<id>\d+)/m).id;

  return [
    m.getDate(),
    m.getId(),
    subject,
    // tx.payee,
    // maybeNumber(tx.amount),
    // getNote(body),
    // acct,
    // pmtId,
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
