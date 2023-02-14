const LunchMoneyAPI = {
  endpoint: 'https://dev.lunchmoney.app',
};

function fmtParams(params) {
  return Object.entries(params)
    .map(([n, v]) => `${n}=${v}`)
    .join('&');
}

function paginate(kind, creds, params) {
  const pages = [];
  console.warn('AMBIENT: UrlFetchApp');
  for (let offset = 0, qty = -1; qty !== 0; offset += qty) {
    const q = fmtParams({ ...params, offset, limit: 128 });
    const resp = UrlFetchApp.fetch(
      `${LunchMoneyAPI.endpoint}/v1/${kind}?${q}`,
      { headers: creds },
    );
    const items = JSON.parse(resp.getContentText())[kind];
    pages.push(items);
    qty = items.length;
    console.log({ kind, offset, qty });
  }
  return pages.flat();
}

const short = dt => dt.toISOString().slice(0, 10);

function loadLunchMoneyTransactions() {
  console.warn('AMBIENT: SpreadsheetApp');
  const doc = SpreadsheetApp.getActive();
  const apiKey = doc.getRangeByName('LM_API_KEY').getValue();
  const range = {
    start: doc.getRangeByName('loadStart').getValue(),
    end: doc.getRangeByName('loadEnd').getValue(),
  };
  const creds = { Authorization: `Bearer ${apiKey}` };
  const txs = paginate('transactions', creds, {
    start_date: short(range.start),
    end_date: short(range.end),
  });
  console.log('txs', txs.length, txs.slice(0, 2));

  const sheet = doc.getSheetByName('Transactions');
  const hd = headings.Transactions;
  sheet.getRange(1, 1, 1, hd.length).setValues([hd]);

  const rows = txs.map(tx => [
    tx.date,
    tx.id,
    JSON.stringify(tx),
    tx.payee,
    tx.amount,
    tx.notes,
    tx.plaid_account_id,
    tx.category_id,
  ]);
  sheet.getRange(2, 1, rows.length, hd.length).setValues(rows);
}

function saveLunchMoneyTransactions() {
  console.warn('AMBIENT: SpreadsheetApp');
  const doc = SpreadsheetApp.getActive();
  const { records: txs } = getSheetRecords(doc.getSheetByName('Transactions'));
  const modTx = txs.filter(tx => tx.Modified);
  const apiKey = doc.getRangeByName('LM_API_KEY').getValue();
  const creds = { Authorization: `Bearer ${apiKey}` };

  modTx.forEach(tx => {
    const transaction = { payee: tx.payee, notes: tx.notes };
    console.log('PUT', tx.id, transaction);
    // https://lunchmoney.dev/#update-transaction
    UrlFetchApp.fetch(`${LunchMoneyAPI.endpoint}/v1/transactions/${tx.id}`, {
      headers: creds,
      method: 'PUT',
      contentType: 'application/json',
      payload: JSON.stringify({ transaction }),
    });
  });
}
