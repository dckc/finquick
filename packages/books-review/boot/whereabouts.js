/**
 * @file Where you were: visits from a Google Maps Timeline export, which a
 * reviewer can check a purchase against. See {@link buildRootObject}.
 *
 * @import { TypeFromInterfaceGuard, TypeFromPattern } from '@endo/patterns';
 * @import { BuildRootObject, Powers } from '@vattr/toybox/src/types.ts';
 */

/** More than a year's visits, at a few a day. */
export const MAX_VISITS = 5000;
const DAY = 24 * 60 * 60 * 1000;

/**
 * The shapes this vat's guard checks, made from the `M` a vat is given (it
 * imports nothing); their static types are inferred from them, below.
 *
 * @param {Powers['M']} M
 */
export const makeShapes = M => {
  /** A visit: these fields, no more, no fewer. */
  const VisitShape = harden({
    startTime: M.string(),
    placeId: M.string(),
    latLng: M.string(),
  });
  const SummaryShape = harden({
    count: M.number(),
    first: M.or(M.string(), null),
    last: M.or(M.string(), null),
  });
  const put = M.call(
    M.arrayOf(VisitShape, { arrayLengthLimit: MAX_VISITS }),
  ).returns(SummaryShape);
  const summary = M.call().returns(SummaryShape);
  /** The timeline page's facet: it uploads visits, and asks how many. */
  const UploaderI = M.interface('Uploader', { put, summary });
  const WhereaboutsI = M.interface('Whereabouts', {
    put,
    summary,
    around: M.call(M.string())
      .optional(M.number())
      .returns(M.arrayOf(VisitShape)),
    getUploader: M.call().returns(M.remotable('Uploader')),
  });
  return harden({ VisitShape, SummaryShape, WhereaboutsI, UploaderI });
};
/** @typedef {ReturnType<typeof makeShapes>} Shapes */
/**
 * A visit from a Google Maps Timeline export: `startTime` with the offset
 * where it happened (`2026-05-09T12:24:00.000-05:00`), Google's `placeId`,
 * and `latLng` as the export writes it (`38.95°, -94.65°`).
 *
 * @typedef {TypeFromPattern<Shapes['VisitShape']>} Visit
 */
/** @typedef {TypeFromPattern<Shapes['SummaryShape']>} Summary */
/** @typedef {TypeFromInterfaceGuard<Shapes['WhereaboutsI']>} Whereabouts the vat's root */
/** @typedef {TypeFromInterfaceGuard<Shapes['UploaderI']>} Uploader what the timeline key designates */

/**
 * The visits in time order; throws if a startTime isn't a time, which
 * couldn't be ordered. Their shape is the caller's to check: this vat's
 * interface guard does, for what comes from other vats.
 *
 * @param {Visit[]} visits
 * @returns {Visit[]}
 */
export const checkVisits = visits => {
  for (const [i, { startTime }] of visits.entries())
    if (Number.isNaN(Date.parse(startTime)))
      throw Error(
        `visit ${i} has a startTime that isn't one: ${JSON.stringify(startTime)}`,
      );
  return harden(
    [...visits].sort(
      (a, b) => Date.parse(a.startTime) - Date.parse(b.startTime),
    ),
  );
};

/**
 * Visits that started on `date` or the `days` before it, by the date where
 * they happened (a startTime's own offset): a card posts a day or two after
 * the purchase.
 *
 * @param {Visit[]} visits
 * @param {string} date YYYY-MM-DD
 * @param {number} days
 */
export const visitsAround = (visits, date, days) => {
  const end = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(end)) throw Error(`not a date: ${JSON.stringify(date)}`);
  const from = new Date(end - days * DAY).toISOString().slice(0, 10);
  return harden(
    visits.filter(v => {
      const day = v.startTime.slice(0, 10);
      return from <= day && day <= date;
    }),
  );
};

/** @param {Visit[]} visits @returns {Summary} */
const summarize = visits =>
  harden({
    count: visits.length,
    first: visits[0]?.startTime ?? null,
    last: visits.at(-1)?.startTime ?? null,
  });

/**
 * The whereabouts vat: it keeps the visits the timeline page uploads, and
 * answers which were near a date, so a reviewer can tell whose purchase a
 * split was and what kind of place it was bought at. Its interface guard
 * takes only {@link Visit}s: when, which place, and where, nothing more.
 *
 * TODO(place names): name each placeId through Google's Place Details, by a
 * WebApp narrowed to the Places API with the key as a header (the boot vat
 * holds the fetch device), and only for visits near an uncategorized split:
 * the API allows 100 lookups a day without billing, so cache them, and stop
 * for the day on a per-day-quota 429 (a prototype: qtrx tools/timeline_places.py).
 *
 * @see https://developers.google.com/maps/documentation/places/web-service/place-details
 *
 * @satisfies {BuildRootObject<{}>}
 */
export const buildRootObject = ({ M, zone }) => {
  const { WhereaboutsI, UploaderI } = makeShapes(M);

  // TODO(storage): the visits live in this incarnation's heap, so a restart
  // or an upgrade forgets them, and the phone uploads again. Keep them
  // durably once we decide how long they stay, and where: not in the book's
  // git repo. (The exo is durable; its methods are made anew each
  // incarnation, around a new `visits`.)
  /** @type {Visit[]} */
  let visits = harden([]);
  /** @type {TypeFromInterfaceGuard<typeof WhereaboutsI>} the guard's types, so the methods agree with what it checks */
  const methods = {
    /** Replace the visits with these; answers a summary. */
    put(uploaded) {
      visits = checkVisits(uploaded);
      return summarize(visits);
    },
    /** How many visits, from when to when. */
    summary() {
      return summarize(visits);
    },
    /** Visits on `date` or the `days` before. */
    around(date, days = 2) {
      return visitsAround(visits, date, days);
    },
    /** The timeline page's facet: `put` and `summary`, but not `around`. */
    getUploader: () => uploader,
  };
  const uploader = zone.exo('Uploader', UploaderI, {
    put: methods.put,
    summary: methods.summary,
  });
  return zone.exo('Whereabouts', WhereaboutsI, methods);
};
