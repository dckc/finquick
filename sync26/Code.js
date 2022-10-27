function maybeMatch(txt, pat) {
  const parts = txt.match(pat);
  return parts ? parts.groups : {};
}

function maybeNumber(amount) {
  return amount ? Number(amount.replace(',', '')) : undefined;
}

function getNote(body) {
  const [_before, rest] = body.split('<!-- note -->');
  const [noteMarkup, _after] = rest.split('</td>');
  const tagPat = /<\/?[a-z]+>/g;
  const charRefPat = /&#(\d+);/g;
  const charRef = (_m, digits) => String.fromCharCode(Number(digits));
  const note = noteMarkup.replace(tagPat, '').replace(charRefPat, charRef).replace(/\s\s+/g, ' ').trim();
  return note;
}

function loadVenmoReceipts() {
  console.warn('AMBIENT: SpreadsheetApp');
  const sheet = SpreadsheetApp.getActive().getSheetByName('Receipts');
  const hd = ['Date', 'Message Id', 'Subject', 'Payee', 'Amount', 'Note', 'Account', 'Payment ID'];
  sheet.getRange(1, 1, 1, hd.length).setValues([hd]);
  let row = 2;
  const query = 'from:(venmo.com) subject:completed "Payment ID"';
  console.warn('AMBIENT: GmailApp');
  const threads = GmailApp.search(query);
  threads.forEach(thread => thread.getMessages().forEach(m => {
    const subject = m.getSubject();
    const body = m.getBody();

    const tx = maybeMatch(subject, /You completed (?<payee>[^']+)'s \$(?<amount>[\d\.,]+) charge request/);

    const acct = maybeMatch(body, /(from|via) your (?<account>[^\.]+)/m).account;
    const pmtId = maybeMatch(body, /Payment ID: (?<id>\d+)/m).id;

    const values = [m.getDate(), m.getId(), subject, tx.payee, maybeNumber(tx.amount), getNote(body), acct, pmtId];
    sheet.getRange(row, 1, 1, values.length).setValues([values]);

    row += 1;
    if (row % 20 === 0) {
      console.log('row', row);
    }
  }));
}
