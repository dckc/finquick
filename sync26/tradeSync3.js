const { parseDate } = Utilities;

const StakeTax = {
  hd: ['timestamp'],
  fixDates: ([t, ...rest]) => [parseDate(t, 'GMT', "yyyy-MM-dd' 'HH:mm:ss"), ...rest],
  filterSince: since => ([t]) => t >= since,
};

const Osmosis = {
  hd: ['status', 'time'],
  fixDates: ([s, t, ...rest]) => [s, parseDate(t, 'GMT', "yyyy/MM/dd' 'HH:mm:ss"), ...rest],
  filterSince: since => ([s, t]) => s === 'success' && t >= since,
};

const Coinbase = {
  hd: ['Timestamp'],
  fixDates:  ([t, ...rest]) => [parseDate(t, 'GMT', "yyyy-MM-dd'T'HH:mm:ss'Z'"), ...rest],
  filterSince: since => ([t]) => t >= since,
};

const MailSearch = {
  query: 'has:attachment from:me trade accounting',
  hd: ['Message Id', 'Date', 'Attachments', 'Subject'],
  sinceRange: 'tradesSince',
};

const SOURCES = { StakeTax, Osmosis, Coinbase };
const SHEETS = { trading: MailSearch, ...SOURCES };

function reset_(active, sheets = SHEETS) {
  const { keys } = Object
  for (const name of keys(sheets)) {
    const sheet = active.getSheetByName(name);
    console.log('clear sheet:', name)
    sheet.clear();
  }
}

function findHd_(rows, sources = SOURCES) {
  const { entries } = Object;
  for (let ix = 0; ix < rows.length; ix++) {
    for (const [name, { hd: [col1] }] of entries(sources)) {
      if (rows[ix][0] === col1) {
        return [name, rows[ix], rows.slice(ix + 1)];
      }
    }
  }
  throw Error(`cannot recognize header: ${rows[0]}`)
}

const zip_ = (xs, ys) => xs.map((x, ix) => [x, ys[ix]]);

function setRange(sheet, hd, rows, hdRow = 1, detailRow = hdRow + 1) {
  sheet.getRange(hdRow, 1, 1, hd.length).setValues([hd]);
  sheet.getRange(detailRow, 1, rows.length, hd.length).setValues(rows);
}

function sheetRecords_(sheet) {
  const { fromEntries } = Object;
  const cols = sheet.getLastColumn();
  const rows = sheet.getLastRow() - 1;
  const [hd] = sheet.getRange(1, 1, 1, cols).getValues();
  const detail = sheet.getRange(2, 1, rows, cols).getValues();
  return detail.map(row => fromEntries(zip_(hd, row)));
}

function loadCSV_(active, att, since) {
  const rows = Utilities.parseCsv(att.getDataAsString());
  const [name, hd, raw] = findHd_(rows);
  console.log('loading from', att.getName(), 'into', name);
  const source = SOURCES[name]
  const detail = raw.map(source.fixDates).filter(source.filterSince(since));

  const sheet = active.getSheetByName(name);
  const last = sheet.getLastRow() + 1;
  console.log('loading', detail.length, 'rows from', att.getName(), 'into', name, 'at', last);
  setRange(sheet, hd, detail, 1, last);
}

function loadTradeAccountingMessages() {
  console.warn('AMBIENT: SpreadsheetApp');
  const active = SpreadsheetApp.getActive();
  reset_(active);

  const sheet = active.getSheetByName('trading');

  const { hd } = MailSearch;

  console.warn('AMBIENT: GmailApp');
  const threads = GmailApp.search(MailSearch.query);
  const msgs = threads.flatMap(thread => thread.getMessages().filter((_m, ix) => ix <= 1));

  const since = active.getRangeByName(MailSearch.sinceRange).getValue();
  const rows = msgs.map(m => {
    const atts = m.getAttachments();

    const row = [m.getId(), m.getDate(), atts.length, m.getSubject()];

    console.log('Found Message:', row);
    atts.forEach(att => loadCSV_(active, att, since));

    return row;
  });
  setRange(sheet, hd, rows);
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

function buildTradeTransactions() {
  console.warn('AMBIENT: SpreadsheetApp');
  const active = SpreadsheetApp.getActive();
  const stakeTax = active.getSheetByName('StakeTax');
  const records = sheetRecords_(stakeTax);
  const splits = records.filter(({ tx_type }) => tx_type === 'TRANSFER');
  const txs = txfrSplits_(splits);
  const { hd, rows } = flattenTxs_(txs);
  console.log('Transfers:', hd, rows.length)
  setRange(active.getSheetByName('trading'), hd, rows, 5)
}

