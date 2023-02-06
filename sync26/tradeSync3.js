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

const zip_ = (xs, ys) => xs.map((x, ix) => [x, ys[ix]]);
const pairs_ = xs => xs.reduce(
  ({ done, left }, next, ix) => (
    ix % 2 === 0 ? { done, left: next} :
     { done: [...done, [left, next]], left: undefined }), { done: [], left: undefined });

function sheetRecords_(sheet) {
  const { fromEntries } = Object;
  const cols = sheet.getLastColumn();
  const rows = sheet.getLastRow() - 1;
  const [hd] = sheet.getRange(1, 1, 1, cols).getValues();
  const detail = sheet.getRange(2, 1, rows, cols).getValues();
  return detail.map(row => fromEntries(zip_(hd, row)));
}

/**
 * pair up records and transform to gnucash format
 * TODO: amount vs. value, using prices
 */
function txfrSplits_(records) {
  const txs = [];
  let splits = [];
  for (const record of records) {
    // TODO: fee
    const { txid, url, timestamp,
      sent_amount, sent_currency,
      received_amount, received_currency,
      wallet_address } = record;
    const currency_name = sent_currency > '' ? sent_currency : received_currency;
    const amount = sent_currency > '' ? -sent_amount : received_amount;
    const account = { wallet_address };
    const split = { guid: { txid }, account, amount, url };
    splits.push(split);
    if (splits.length === 1) {
      const [_all, hash, _msg] = txid.match(/([^-]+)-(.*)/);
      txs.push({ guid: { hash }, date_posted: timestamp, currency_name, splits })
    } else {
      splits = [];
    }
  }
  return txs;
}

/**
 * { x: { y: 123 }} => { x_y: 123 }
 */
function flatten_(record) {
  const { entries, fromEntries } = Object;
  const recur = (pfx, obj) => entries(obj).flatMap(
    ([k, v]) => (typeof(v) === 'object' && ! (v instanceof Date)) ?
      recur(`${pfx}${k}_`, v) : [[`${pfx}${k}`, v]]);
  return fromEntries(recur('', record));
}

function flattenTxs_(txs) {
  const { keys } = Object;
  const records = [];
  for (const { splits, ...rest } of txs) {
    records.push(flatten_(rest));
    splits.forEach(split => records.push(flatten_(split)))
  }
  const hd = [...new Set(records.flatMap(r => keys(r)))];
  const rows = records.map(rec => hd.map(k => rec[k]));
  return { records, hd, rows };
}

function setRange(sheet, hd, rows, hdRow = 1) {
  sheet.getRange(hdRow, 1, 1, hd.length).setValues([hd]);
  sheet.getRange(hdRow + 1, 1, rows.length, hd.length).setValues(rows);
}

function buildTradeTransactions() {
  console.warn('AMBIENT: SpreadsheetApp');
  const active = SpreadsheetApp.getActive();
  const stakeTax = active.getSheetByName('StakeTax');
  const records = sheetRecords_(stakeTax);
  const splits = records.filter(({ tx_type }) => tx_type === 'TRANSFER');
  const txs = txfrSplits_(splits);
  const { hd, rows } = flattenTxs_(txs);
  console.log('@@@stakeTax', hd, rows)
  setRange(active.getSheetByName('trading'), hd, rows, 5)
}

