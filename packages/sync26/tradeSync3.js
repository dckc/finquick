const { parseDate } = Utilities;

const StakeTax = {
  hd: ['timestamp'],
  dateFormat: "yyyy-MM-dd' 'HH:mm:ss",
  dateColumn: 'timestamp',
};

const Osmosis = {
  hd: ['status', 'time'],
  dateColumn: 'time',
  dateFormat: "yyyy/MM/dd' 'HH:mm:ss",
};

const Coinbase = {
  hd: ['Timestamp'],
  dateColumn: 'Timestamp',
  dateFormat: "yyyy-MM-dd'T'HH:mm:ss'Z'",
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

function sheetRecords_(sheet) {
  const { fromEntries } = Object;
  const cols = sheet.getLastColumn();
  const rows = sheet.getLastRow() - 1;
  const [hd] = sheet.getRange(1, 1, 1, cols).getValues();
  const detail = sheet.getRange(2, 1, rows, cols).getValues();
  return detail.map(row => fromEntries(zip_(hd, row)));
}

function parseBlockchainDate (txt = '2023-02-04 05:19:32', dateFormat = StakeTax.dateFormat) {
  return parseDate(txt, 'GMT', dateFormat)
}

function byDate_(rows, source) {
  const colIx = source.hd.indexOf(source.dateColumn);
  const withDates = rows.map(row => {
    const cells = [...row];
    const txt = cells[colIx];
    const dt = parseDate(txt, 'GMT', source.dateFormat);
    cells[colIx] = dt;
    return cells;
  });
  return withDates;
};

function loadCSV_(active, att) {
  const rows = Utilities.parseCsv(att.getDataAsString());
  const [name, hd, raw] = findHd_(rows);
  console.log('loading from', att.getName(), 'into', name);
  const source = SOURCES[name]
  const detail = byDate_(raw, source);

  const sheet = active.getSheetByName(name);
  const last = sheet.getLastRow() + 2;
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

  const rows = msgs.map(m => {
    const atts = m.getAttachments();

    const row = [m.getId(), m.getDate(), atts.length, m.getSubject()];

    console.log('Found Message:', row);
    atts.forEach(att => loadCSV_(active, att));

    return row;
  });
  setRange(sheet, hd, rows);
}

function txDate_(timestamp) {
  const dateTime = timestamp.toISOString();
  return { date_posted: dateTime.slice(0, 10), number: dateTime.slice(11, 16) + 'Z' };
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
      exchange, wallet_address } = record;
    const amount = sent_currency > '' ? -sent_amount : received_amount;
    const action = sent_currency > '' ? 'Sell' : 'Buy';
    const sym = sent_currency > '' ? sent_currency : received_currency;
    // TODO: price
    const split = { action, memo: txid, account: `${sym} ${wallet_address}`, amount, sym, reconcile: 'c', url };
    splits.push(split);
    if (splits.length === 1) {
      const [_all, _hash, _msg] = txid.match(/([^-]+)-(.*)/);
      const dateTime = timestamp.toISOString();
      txs.push({ ...txDate_(timestamp), description: exchange, splits })
    } else {
      splits = [];
      txs.at(-1).description += ` to ${exchange}`;
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
    splits.forEach((split, ix) => {
      if (ix === 0) {
        records.push(flatten_({ ...rest, ...split }));
      } else {
        records.push(flatten_(split))
      }
    });
  }
  const hd = [...new Set(records.flatMap(r => keys(r)))];
  const rows = records.map(rec => hd.map(k => rec[k]));
  return { records, hd, rows };
}

const max_ = xs => xs.reduce((acc, next) => next > acc ? next : acc);
const sum_ = xs => xs.reduce((acc, next) => acc + next, 0);
const select_ = (recs, prop) => recs.map(r => r[prop]);
const round_ = (x, d) => Number(x.toPrecision(d))

/**
 * select max(Timestamp), Asset, sum(`Quantity Transacted`), sum(Total), sum(Fees) group by Asset")
 */
function coinbaseTrades(active, since, asset = 'ATOM') {
  const coinbaseSheet = active.getSheetByName('Coinbase');
  const records = sheetRecords_(coinbaseSheet);
  const current = records
    .filter(r => r[Coinbase.dateColumn] >= since &&
     /Trade/.test(r['Transaction Type']) && 
     r.Asset === asset);
  const agg = {
    Timestamp: max_(select_(current, 'Timestamp')),
    quantity: sum_(select_(current, 'Quantity Transacted')),
    proceeds: sum_(select_(current, 'Total (inclusive of fees and/or spread)')),
    fees: sum_(select_(current, 'Fees and/or Spread')),
  };

  const reconcile = 'c';
  const tx = {
    ...txDate_(agg.Timestamp), description: `${asset} Trade`,
    splits: [
      { account: 'ATOM Wallet', action: 'Sell', amount: -agg.quantity, reconcile },
      { account: 'USD Wallet', amount: agg.proceeds, memo: 'proceeds', reconcile },
      { account: 'AIE:Fees', amount: agg.fees, memo: 'Fees', reconcile },
    ]}
  return [tx];
}

function stakeTaxTransfers(active, since) {
  const stakeTax = active.getSheetByName('StakeTax');
  const records = sheetRecords_(stakeTax);
  const { dateColumn } = StakeTax;
  const txfrs = records
    .filter(({ tx_type }) => tx_type === 'TRANSFER')
    .filter(({ [dateColumn]: dt }) => dt >= since);
  const splits = txfrs
    .sort((a, b) => a[dateColumn].getTime() - b[dateColumn].getTime());
  const txs = txfrSplits_(splits);
  return txs;
}

function buildTradeTransactions() {
  console.warn('AMBIENT: SpreadsheetApp');
  const active = SpreadsheetApp.getActive();
  const since = active.getRangeByName(MailSearch.sinceRange).getValue();

  const txs = [
    ...stakeTaxTransfers(active, since),
    ...coinbaseTrades(active, since),
  ].sort((a, b) => `${a.date_posted} ${a.number}` > `${b.date_posted} ${b.number}`);

  const { hd, rows } = flattenTxs_(txs);
  console.log('Transactions:', hd, rows.length);

  const importSheet = active.getSheetByName('tx_import');
  importSheet.clear();
  setRange(importSheet, hd, rows)
}

