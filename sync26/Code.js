function maybeMatch(txt, pat) {
  const parts = txt.match(pat);
  return parts ? parts.groups : {};
}

function maybeNumber(amount) {
  return amount ? Number(amount.replace(",", "")) : undefined;
}

function getNote(body) {
  const [_before, rest] = body.split("<!-- note -->");
  const [noteMarkup, _after] = rest.split("</td>");
  const tagPat = /<\/?[a-z]+>/g;
  const charRefPat = /&#(\d+);/g;
  const charRef = (_m, digits) => String.fromCharCode(Number(digits));
  const note = noteMarkup
    .replace(tagPat, "")
    .replace(charRefPat, charRef)
    .replace(/\s\s+/g, " ")
    .trim();
  return note;
}

const headings = {
  Receipts: [
    "Date",
    "Message Id",
    "Subject",
    "Payee",
    "Amount",
    "Note",
    "Account",
    "Payment ID",
  ],
  Transactions: [
    "Date",
    "Id",
    "Detail",
    "Payee",
    "Amount",
    "Note",
    "Account",
    "Category",
  ],
};

function loadVenmoReceipts() {
  console.warn("AMBIENT: SpreadsheetApp");
  const sheet = SpreadsheetApp.getActive().getSheetByName("Receipts");
  const hd = headings.Receipts;
  sheet.getRange(1, 1, 1, hd.length).setValues([hd]);
  let row = 2;
  const query = 'from:(venmo.com) subject:completed "Payment ID"';
  console.warn("AMBIENT: GmailApp");
  const threads = GmailApp.search(query);
  threads.forEach((thread) =>
    thread.getMessages().forEach((m) => {
      const subject = m.getSubject();
      const body = m.getBody();

      const tx = maybeMatch(
        subject,
        /You completed (?<payee>[^']+)'s \$(?<amount>[\d\.,]+) charge request/
      );

      const acct = maybeMatch(
        body,
        /(from|via) your (?<account>[^\.]+)/m
      ).account;
      const pmtId = maybeMatch(body, /Payment ID: (?<id>\d+)/m).id;

      const values = [
        m.getDate(),
        m.getId(),
        subject,
        tx.payee,
        maybeNumber(tx.amount),
        getNote(body),
        acct,
        pmtId,
      ];
      sheet.getRange(row, 1, 1, values.length).setValues([values]);

      row += 1;
      if (row % 20 === 0) {
        console.log("row", row);
      }
    })
  );
}

const LunchMoneyAPI = {
  endpoint: "https://dev.lunchmoney.app",
};

function fmtParams(params) {
  return Object.entries(params)
    .map(([n, v]) => `${n}=${v}`)
    .join("&");
}

function paginate(kind, creds, params) {
  const pages = [];
  console.warn("AMBIENT: UrlFetchApp");
  for (let offset = 0, qty = -1; qty !== 0; offset += qty) {
    const q = fmtParams({ ...params, offset, limit: 128 });
    const resp = UrlFetchApp.fetch(
      `${LunchMoneyAPI.endpoint}/v1/${kind}?${q}`,
      { headers: creds }
    );
    const items = JSON.parse(resp.getContentText())[kind];
    pages.push(items);
    qty = items.length;
    console.log({ kind, offset, qty });
  }
  return pages.flat();
}

function loadLunchMoneyTransactions() {
  console.warn("AMBIENT: SpreadsheetApp");
  const doc = SpreadsheetApp.getActive();
  const apiKey = doc.getRangeByName("LM_API_KEY").getValue();
  const creds = { Authorization: `Bearer ${apiKey}` };
  const txs = paginate("transactions", creds, {
    start_date: "2022-09-01",
    end_date: "2050-01-01",
  });
  console.log("txs", txs.length, txs.slice(0, 5));

  console.warn("AMBIENT: SpreadsheetApp");
  const sheet = SpreadsheetApp.getActive().getSheetByName("Transactions");
  const hd = headings.Transactions;
  sheet.getRange(1, 1, 1, hd.length).setValues([hd]);
  let row = 2;
  txs.forEach((tx) => {
    const values = [
      tx.date,
      tx.id,
      JSON.stringify(tx),
      tx.payee,
      tx.amount,
      tx.notes,
      tx.plaid_account_id,
      tx.category_id,
    ];
    sheet.getRange(row, 1, 1, values.length).setValues([values]);

    row += 1;
    if (row % 20 === 0) {
      console.log("row", row);
    }
  });
}

const zip = (xs, ys) => xs.map((x, ix) => [x, ys[ix]]);

function getRowRecord(sheet, row, headings) {
  const [values] = sheet.getRange(row, 1, 1, headings.length).getValues();
  const entries = zip(headings, values);
  return Object.fromEntries(entries);
}

function getSheetRecords(sheet) {
  const hd = [];
  for (
    let col = 1, name;
    (name = sheet.getRange(1, col).getValue()) > "";
    col += 1
  ) {
    hd.push(name);
  }
  const data = sheet.getRange(2, 1, sheet.getLastRow(), hd.length).getValues();
  const records = [];
  for (const values of data) {
    const entries = zip(hd, values);
    const record = Object.fromEntries(entries);
    if (!record[hd[0]]) break;
    records.push(record);
  }
  return { hd, records };
}

function updateRecord(sheet, hd, row, record) {
  for (const [name, value] of Object.entries(record)) {
    const col = hd.findIndex((h) => h === name) + 1;
    sheet.getRange(row, col).setValues([[value]]);
  }
}

const DAY = 24 * 60 * 60 * 1000;
function daysBetween(start, end) {
  const dur = end.getTime() - start.getTime();
  return Math.floor(dur / DAY);
}

function updateTransactionDetailsFromReceipts() {
  console.warn("AMBIENT: SpreadsheetApp");
  const doc = SpreadsheetApp.getActive();
  const { records: accounts } = getSheetRecords(doc.getSheetByName("Accounts"));

  const { records: receipts } = getSheetRecords(doc.getSheetByName("Receipts"));
  const { hd: txHd, records: txs } = getSheetRecords(
    doc.getSheetByName("Transactions")
  );
  let dest = txs.length;
  let startOfLastMatchDate;

  const short = (dt) => dt.toISOString().slice(0, 10);

  for (let row = 2; true; row += 1) {
    const receipt = receipts[row - 2];
    if (!receipt.Date) break;
    // console.log('receipt', row, short(receipt.Date), receipt.Amount);

    const account = accounts.find(
      (acct) => acct.venmo_name.toLowerCase() === receipt.Account.toLowerCase()
    );

    if (!account) {
      console.warn("cannot find account:", row, receipt.Account);
      continue;
    }
    // console.log('account', row, short(receipt.Date), receipt.Amount,
    //  account.id, account.code, account.account_name);

    let tx;
    let currentDate;
    let startOfCurrentDate;
    for (; dest > 1; dest -= 1) {
      tx = txs[dest - 2];
      if (!currentDate || currentDate.getTime() !== tx.Date.getTime()) {
        currentDate = tx.Date;
        startOfCurrentDate = dest;
      }
      const delta = daysBetween(tx.Date, receipt.Date);
      // console.log('match?', dest, short(tx.Date), delta, tx.Account, tx.Amount);
      if (delta < -3) continue; // not there yet
      if (delta > 3) {
        tx = null;
        break; // too far
      }
      if (tx.Account !== account.id || tx.Amount !== receipt.Amount) continue;
      const detail = JSON.parse(tx.Detail);
      if (detail.original_name === "Venmo") break;
    }
    if (dest <= 1 || tx === null) {
      console.warn("cannot find transaction:", row, receipt);
      if (daysBetween(receipt.Date, txs[0].Date) > 3) {
        console.warn(
          "remaining transactions are too old",
          row,
          short(receipt.Date),
          "<<",
          short(txs[0].Date)
        );
        break;
      }
      dest = startOfLastMatchDate;
      continue;
    }
    console.log(
      "match!",
      { row, dest },
      short(receipt.Date),
      short(tx.Date),
      tx.Amount,
      account.name,
      receipt.Payee,
      receipt.Note
    );
    updateRecord(doc.getSheetByName("Transactions"), txHd, dest, {
      Modified: 1,
      Payee: receipt.Payee,
      Note: receipt.Note,
    });
    // When we resume, resume at the beginning of the day.
    startOfLastMatchDate = startOfCurrentDate;
    dest = startOfLastMatchDate;
  }
}
