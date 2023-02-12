function maybeMatch(txt, pat) {
  const parts = txt.match(pat);
  return parts ? parts.groups : {};
}

function maybeNumber(amount) {
  return amount ? Number(amount.replace(',', '')) : undefined;
}

function getNote(body) {
  const [_before, rest] = body.split('<!-- note -->');
  if (!rest) {
    return '';
  }
  const [noteMarkup, _after] = rest.split('</td>');
  const tagPat = /<\/?[a-z]+>/g;
  const charRefPat = /&#(\d+);/g;
  const charRef = (_m, digits) => String.fromCharCode(Number(digits));
  const note = noteMarkup.replace(tagPat, '').replace(charRefPat, charRef).replace(/\s\s+/g, ' ').trim();
  return note;
}

const headings = {
  Receipts: ['Date', 'Message Id', 'Subject', 'Payee', 'Amount', 'Note', 'Account', 'Payment ID'],
  Transactions: ['date', 'id', 'Detail', 'payee', 'amount', 'notes', 'plaid_account_id', 'category_id'],
};

function loadVenmoReceipts() {
  console.warn('AMBIENT: SpreadsheetApp');
  const sheet = SpreadsheetApp.getActive().getSheetByName('Receipts');
  const hd = headings.Receipts;
  sheet.getRange(1, 1, 1, hd.length).setValues([hd]);
  let row = 2;
  const query = 'from:(venmo.com) Completed "Payment ID"';
  console.warn('AMBIENT: GmailApp');
  const threads = GmailApp.search(query);
  threads.forEach(thread => thread.getMessages().forEach((m, ix) => {
    if (ix > 0) return;
    const subject = m.getSubject();
    const body = m.getBody();

    const tx = maybeMatch(subject, /You (?:paid|completed) (?<payee>[^'\$]+)(?:'s )?\$(?<amount>[\d\.,]+)/);
    if (!tx.amount) {
      console.warn('no amount??', subject)
    }
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

function UpdateTransactionDetailsFromReceipts() {
  console.warn('AMBIENT: SpreadsheetApp');
  const doc = SpreadsheetApp.getActive();
  const { records: accounts } = getSheetRecords(doc.getSheetByName('Accounts'));

  const { records: receipts } = getSheetRecords(doc.getSheetByName('Receipts'));
  const { hd: txHd, records: txs } = getSheetRecords(doc.getSheetByName('Transactions'));
  let dest = txs.length + 1;
  let startOfLastMatchDate;

  for (let row = 2; true; row += 1) {
    const receipt = receipts[row - 2];
    if (!receipt.Date) break;
    // console.log('receipt', row, short(receipt.Date), receipt.Amount);

    const account = accounts.find(
      acct => acct.venmo_name.toLowerCase() === receipt.Account.toLowerCase());

    if (!account) {
      console.warn('cannot find account:', row, receipt.Account);
      continue;
    }
    // console.log('account', row, short(receipt.Date), receipt.Amount,
    //  account.id, account.code, account.account_name);

    let tx;
    let currentDate;
    let startOfCurrentDate;
    for (; dest > 1; dest -= 1) {
      tx = txs[dest - 2];
      if (!currentDate || (currentDate.getTime() !== tx.date.getTime())) {
        currentDate = tx.date;
        startOfCurrentDate = dest;
      }
      const delta = daysBetween(tx.date, receipt.Date);
      // console.log('match?', dest, short(tx.Date), delta, tx.plaid_account_id, tx.Amount);
      if (delta < -3) continue; // not there yet
      if (delta > 3) {
        tx = null;
        break; // too far
      }
      if (tx.plaid_account_id !== account.id || tx.amount !== receipt.Amount) continue;
      const detail = JSON.parse(tx.Detail);
      if (detail.original_name === 'Venmo') break;
    }
    if (dest <= 1 || !tx) {
      console.warn('cannot find transaction:', row, receipt, { startOfLastMatchDate });
      if (daysBetween(receipt.Date, txs[0].date) > 3) {
        console.warn('remaining transactions are too old', row, short(receipt.Date), '<<', short(txs[0].date));
        break;
      }
      if (startOfLastMatchDate) {
        dest = startOfLastMatchDate;
      }
      continue;
    }
    console.log('match!', { row, dest }, short(receipt.Date), short(tx.date), tx.amount, account.name, receipt.Payee, receipt.Note);
    updateRecord(doc.getSheetByName('Transactions'), txHd, dest,
      { Modified: 1, payee: receipt.Payee, notes: JSON.stringify([receipt.Note, {venmo: receipt['Payment ID']}]) })
    // When we resume, resume at the beginning of the day.
    startOfLastMatchDate = startOfCurrentDate;
    dest = startOfLastMatchDate;
  }
}
