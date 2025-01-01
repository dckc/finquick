const Venmo = {
  sheet: 'Receipts',
  hd: [
    'Date',
    'Message Id',
    'Subject',
    'Payee',
    'Amount',
    'Note',
    'Account',
    'Payment ID',
  ],
  queryRange: 'venmoQuery',
};

const headings = {
  Receipts: [
    'Date',
    'Message Id',
    'Subject',
    'Payee',
    'Amount',
    'Note',
    'Account',
    'Payment ID',
  ],
  Transactions: [
    'date',
    'id',
    'Detail',
    'payee',
    'amount',
    'notes',
    'plaid_account_id',
    'category_id',
  ],
};

function maybeMatch(txt, pat) {
  const parts = txt.match(pat);
  return parts ? parts.groups : {};
}

function maybeNumber(amount) {
  return amount ? Number(amount.replace(',', '')) : undefined;
}

function getNote(body) {
  const [_before0, rest0] = body.split('You paid ');
  if (!rest0) return '';
  const [_before1, rest1] = rest0.split('</div>');
  if (!rest1) return '';
  const [_before, rest] = rest0.split('text-align:left">');
  if (!rest) return '';

  const [noteMarkup, _after] = rest.split('</p>');
  const tagPat = /<\/?[a-z]+>/g;
  const charRefPat = /&#(\d+);/g;
  const charRef = (_m, digits) => String.fromCharCode(Number(digits));
  const note = noteMarkup
    .replace(tagPat, '')
    .replace(charRefPat, charRef)
    .replace(/\s\s+/g, ' ')
    .trim();
  return note;
}

function messageDetail_(m) {
  const subject = m.getSubject();
  const body = m.getBody();

  const tx = maybeMatch(
    subject,
    /You (?:paid|completed) (?<payee>[^'\$]+)(?:'s )?\$(?<amount>[\d\.,]+)/,
  );
  if (!tx.amount) {
    console.warn('no amount??', subject);
  }
  const acct = maybeMatch(body, /(from|via) your (?<account>[^\.]+)/m).account;
  const pmtId = maybeMatch(body, /Payment ID: (?<id>\d+)/m).id;

  return [
    m.getDate(),
    m.getId(),
    subject,
    tx.payee,
    maybeNumber(tx.amount),
    getNote(body),
    acct,
    pmtId,
  ];
}

function LoadVenmoReceipts(_nonce, io = {}) {
  const {
    doc = (console.warn('AMBIENT: SpreadsheetApp'), SpreadsheetApp.getActive()),
    sheet = doc.getSheetByName(Venmo.sheet),
    query = doc.getRangeByName(Venmo.queryRange).getValue(),
    threads = (console.warn('AMBIENT: GmailApp', query),
    GmailApp.search(query)),
  } = io;

  if (!threads.length) throw Error(`Venmo query (${query}) found no threads`);
  const rows = [];
  threads.forEach(thread =>
    thread.getMessages().forEach((m, ix) => {
      if (ix > 0) return;
      const values = messageDetail_(m);
      rows.push(values);
    }),
  );
  if (!rows.length) throw Error('no Venmo receipts found');
  setRange(sheet, Venmo.hd, rows);
}

function venmoEdits_(tx, receipts) {}

function VenmoLookup(tx) {
  console.warn('AMBIENT: SpreadsheetApp');
  const doc = SpreadsheetApp.getActive();

  const { records: receipts } = getSheetRecords(doc.getSheetByName('Receipts'));
  const sameAmount = receipts.filter(item => item.Amount === -tx.Amount);
  const ok = sameAmount.filter(item => {
    const delta = daysBetween(item.Date, tx.Date);
    return delta >= 0 && delta <= 4;
  });
  // console.log('amount and date', ok)
  if (ok.length < 1) {
    throw Error(`no matches`);
  }
  if (ok.length > 1) {
    throw Error(`too many matches: ${ok.length}`);
  }
  const [it] = ok;

  const memo = JSON.stringify([it.Note, { venmo: it['Payment ID'] }]);
  const edits = { Description: it.Payee, memo };
  console.log(tx.Date, tx.Amount, edits);
  return edits;
}

function testVenmoLookup(rowNum = 77) {
  console.warn('AMBIENT: SpreadsheetApp');
  const active = SpreadsheetApp.getActive();

  const sheet = active.getSheetByName('Transactions (2)');
  const cols = sheet.getLastColumn();
  const [hd] = sheet.getRange(1, 1, 1, cols).getValues();
  const rec = getRowRecord(sheet, rowNum, hd);

  VenmoLookup(rec);
}

function UpdateTransactionDetailsFromReceipts() {
  console.warn('AMBIENT: SpreadsheetApp');
  const doc = SpreadsheetApp.getActive();
  const { records: accounts } = getSheetRecords(doc.getSheetByName('Accounts'));

  const { records: receipts } = getSheetRecords(doc.getSheetByName('Receipts'));
  const { hd: txHd, records: txs } = getSheetRecords(
    doc.getSheetByName('Transactions'),
  );
  let dest = txs.length + 1;
  let startOfLastMatchDate;

  for (let row = 2; true; row += 1) {
    const receipt = receipts[row - 2];
    if (!receipt.Date) break;
    // console.log('receipt', row, short(receipt.Date), receipt.Amount);

    const account = accounts.find(
      acct => acct.venmo_name.toLowerCase() === receipt.Account.toLowerCase(),
    );

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
      if (!currentDate || currentDate.getTime() !== tx.date.getTime()) {
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
      if (tx.plaid_account_id !== account.id || tx.amount !== receipt.Amount)
        continue;
      const detail = JSON.parse(tx.Detail);
      if (detail.original_name === 'Venmo') break;
    }
    if (dest <= 1 || !tx) {
      console.warn('cannot find transaction:', row, receipt, {
        startOfLastMatchDate,
      });
      if (daysBetween(receipt.Date, txs[0].date) > 3) {
        console.warn(
          'remaining transactions are too old',
          row,
          short(receipt.Date),
          '<<',
          short(txs[0].date),
        );
        break;
      }
      if (startOfLastMatchDate) {
        dest = startOfLastMatchDate;
      }
      continue;
    }
    console.log(
      'match!',
      { row, dest },
      short(receipt.Date),
      short(tx.date),
      tx.amount,
      account.name,
      receipt.Payee,
      receipt.Note,
    );
    updateRecord(doc.getSheetByName('Transactions'), txHd, dest, {
      Modified: 1,
      payee: receipt.Payee,
      notes: JSON.stringify([receipt.Note, { venmo: receipt['Payment ID'] }]),
    });
    // When we resume, resume at the beginning of the day.
    startOfLastMatchDate = startOfCurrentDate;
    dest = startOfLastMatchDate;
  }
}
