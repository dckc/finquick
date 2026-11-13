const sheetName = 'Senders';
const pageSize = 100;
const hd = ['id', 'date', 'from', 'subject']

function MessageDetail(query = 'category:updates ', _nonce, io = {}) {
  const { mail = GmailApp } = io;

  const rows = [hd];
  console.log({ query, pageSize });
  for(let page = 0;; page += 1) {
    const threads = mail.search(query, page * pageSize, pageSize);
    if (threads.length === 0) break;
    const lastMessage = threads.at(-1).getMessages().at(-1);
    console.log('page', page, page * pageSize, threads.length, lastMessage.getDate(), lastMessage.getSubject());
    for (const thread of threads) {
      for (const msg of thread.getMessages()) {
        const detail = {
          id: msg.getId(),
          date: msg.getDate(),
          from: msg.getFrom(),
          subject: msg.getSubject(),
        }
        rows.push(Object.values(detail));
      }
    }
  }
  return { hd, rows };
}

function getSenderFreq(query = 'category:updates ', endTime, _nonce, io = {}) {
  const DAY = 24 * 60 * 60 * 1000;
  const {
    mail = GmailApp,
    duration = 90 * DAY,
  } = io;

  const bySender = {};
  const pageSize = 100;
  const startTime = new Date(endTime.getTime() - duration);
  const fmtDate = dt => dt.toISOString().slice(0, '2024-01-01'.length);
  const timeLimitedQuery = `${query} after:${fmtDate(startTime)} before:${fmtDate(endTime)}`
  console.log(timeLimitedQuery);
  for(let page = 0;; page += 1) {
    const threads = mail.search(timeLimitedQuery, page * pageSize, pageSize);
    if (threads.length === 0) break;
    const lastMessage = threads.at(-1).getMessages().at(-1);
    console.log('page', page, page * pageSize, threads.length, lastMessage.getDate(), lastMessage.getSubject());
    for (const thread of threads) {
      for (const msg of thread.getMessages()) {
        const party = msg.getFrom();
        bySender[party] |= 0;
        bySender[party] += 1;
      }
    }
  }

  const lexical = (sa, sb) => sa === sb ? 0 : (sa < sb ? -1 : 1);
  const byFreq = ([ka, va], [kb, vb]) => va === vb ? lexical(ka, kb) : vb - va;
  const ordered = Object.entries(bySender).sort(byFreq);

  return ordered;
}

const ReportSenders = (query = 'category:updates ', endTime = new Date(), nonce, io = {}) => {
  const {
    mail = GmailApp,
    active = SpreadsheetApp.getActive(),
    sheet = active.getSheetByName(sheetName),
  } = io;
  // const rows = getSenderFreq(query, endTime, nonce, { mail });
  // const hd = ['sender', 'freq'];
  const { hd, detail } = MessageDetail(query, nonce, { mail });
  setRange(sheet, hd, rows);
}