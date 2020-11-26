// @ts-check

const CONFIG = {
  cal_id: "c_7b51gcitqe5qlqiot14jotabr8@group.calendar.google.com",
  guests: "mary@dm93.org,dan@dm93.org",
  owners: {
    "dan@dm93.org": "EB:Dad",
    "mary@dm93.org": "DB:Mom",
  },
};

const DAY = 24 * 60 * 60 * 1000;
const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const { freeze } = Object;

/**
 * @param {GoogleAppsScript.Events.DoGet} e
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function doGet(e) {
  const calendar = CalendarApp.getOwnedCalendarById(CONFIG.cal_id);

  const [start, end] = [e.parameter["start"], e.parameter["end"]];
  const txCal = TxCal(calendar);
  const status = txCal.status(start, end, CONFIG.owners);
  const it = {
    name: calendar.getName(),
    id: calendar.getId(),
    status,
  };
  return ContentService.createTextOutput(
    JSON.stringify(it, null, 2)
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * @typedef {{
 *   tx_date: string,
 *   description: string,
 *   amount: number,
 *   memo: string,
 *   memo_acct: string,
 *   tx_guid: string,
 *   acct_path: string,
 *   online_id: string,
 * }} Tx
 */
/** @type { Tx } */
const TX_EXAMPLE = {
  tx_date: "2020-08-21",
  description: "PRICE CHOPPER #119 OVERLAND PARK",
  amount: 7.23,
  memo: "",
  memo_acct: "GOOGLE PAY ENDING IN 6059",
  tx_guid: "56845dc213c10cd5931b20a5df45df0e",
  acct_path: "Current:CC:Discover",
  online_id: "FITID20200823-7.23QXO6B",
};

const fmt = (obj) => JSON.stringify(obj, null, 2);

/**
 * @param {GoogleAppsScript.Events.DoPost} e
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function doPost(e) {
  const txCal = TxCal(CalendarApp.getOwnedCalendarById(CONFIG.cal_id));
  const { DELETE: toDelete, PATCH: toPatch, POST: toPost } = JSON.parse(
    e.postData.contents
  );
  const result = {
    deleted: toDelete ? txCal.deleteEach(toDelete) : null,
    patched: toPatch ? txCal.patchEach(toPatch) : null,
    posted: toPost ? txCal.postEach(toPost, CONFIG.guests) : null,
  };

  return ContentService.createTextOutput(fmt(result)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/**
 *
 * @param {Calendar} cal
 * @typedef { GoogleAppsScript.Calendar.Calendar } Calendar
 * @typedef { { tx_guid: string, id: string }[] } Crosswalk
 */
function TxCal(cal) {
  const dt = (/** @type { string } */ ymd) => new Date(Date.parse(ymd));
  const { parse } = JSON;

  return freeze({
    /**
     *
     * @param {string} start
     * @param {string} end
     * @param {Record<string, string>} owners
     */
    status(start, end, owners) {
      const events = cal.getEvents(dt(start), dt(end));
      return events.map((event) => {
        const accts = Object.fromEntries(
          event
            .getGuestList(true)
            .filter((eg) => `${eg.getGuestStatus()}` == "YES")
            .map((eg) => ["acct_path", owners[eg.getEmail()]])
        );
        const tx = JSON.parse(event.getDescription());
        return {
          title: event.getTitle(),
          post_date: event.getStartTime(),
          ...tx,
          ...accts,
        };
      });
    },
    /** @type {(toDelete: { day: string, tx_guid: string}[]) => Crosswalk } */
    deleteEach(toDelete) {
      return toDelete
        .map(({ day, tx_guid }) => {
          const start = dt(day);
          const stop = new Date(start.valueOf() + DAY);
          const found = cal
            .getEvents(start, stop)
            .filter((ev) => parse(ev.getDescription()).tx_guid === tx_guid);
          return found.map((ev) => {
            const id = ev.getId();
            ev.deleteEvent();
            return { tx_guid, id };
          });
        })
        .flat();
    },
    /** @type { (lo: string, hi: string) => number } */
    deleteRange(lo, hi) {
      const all = cal.getEvents(dt(lo), dt(hi));
      all.forEach((ev) => ev.deleteEvent());
      return all.length;
    },
    patchEach(toPatch) {
      if (toPatch) throw new Error("not implemented");
    },
    /** @type {(toPost: Tx[], guests: string) => Crosswalk} */
    postEach(toPost, guests) {
      // ISSUE: how many of these are we allowed to do in one request?
      return toPost.map((tx) => {
        // noon UTC should be on the right day in local time
        const start = Date.parse(tx.tx_date) + DAY / 2;
        const { tx_guid, online_id, memo, memo_acct } = tx;
        const event = cal.createAllDayEvent(
          `${USD.format(tx.amount)} @ ${tx.description}`,
          new Date(start),
          new Date(start + DAY),
          {
            location: tx.acct_path,
            description: fmt({ memo_acct, memo, tx_guid, online_id }),
            guests,
          }
        );
        return { tx_guid: tx.tx_guid, id: event.getId() };
      });
    },
  });
}
