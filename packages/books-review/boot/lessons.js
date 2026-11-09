/**
 * What reviewers decided, kept across books: each book snapshot gets its own
 * books, reviewer, and categorizer vats, but what a person taught one
 * categorizer, every later one should know.
 *
 * A reviewer gets the recorder; a categorizer, the reader. Neither can do
 * the other's part.
 */
/**
 * @import { CastedPattern, TypeFromInterfaceGuard, TypeFromPattern } from '@endo/patterns';
 * @import { BuildRootObject, MapStore, Powers } from '@vattr/toybox/src/types.ts';
 * @import { Put, Update } from '../stores.ts';
 * @import { Split } from './books.js';
 * @import { TreeId } from '../types.ts';
 */

/** A description as lessons match it: case and surrounding space aside. @param {string} d */
const normal = d => d.trim().toUpperCase();

/**
 * A lesson's own fields: its split's description, the proposed and final
 * accounts by name, the verdict and the proposer's reason, the reviewer's
 * note, and the book snapshot it was decided in.
 *
 * @param {Powers['M']} M
 */
const makeLessonShapes = M => {
  const required = harden({
    description: M.string(),
    proposed: M.string(),
    status: M.or('accepted', 'corrected', 'rejected'),
    reason: M.string(),
    book: /** @type {CastedPattern<TreeId>} */ (M.string()),
  });
  const optional = harden({ final: M.string(), note: M.string() });
  return harden({
    required,
    optional,
    LessonOwnShape: M.splitRecord(required, optional),
  });
};
/**
 * What a reviewer decided, kept across books: the split, as the view
 * described it but for its guid, with the lesson's own fields.
 *
 * @typedef {Omit<Split, 'split'> & TypeFromPattern<ReturnType<typeof makeLessonShapes>['LessonOwnShape']>} Lesson
 */

/**
 * The recorder's and the reader's guards. They check a lesson's own
 * fields; the rest, its split's, the view's guard checked, and a vat
 * can't import another's shapes. (Cast, since TypeFromPattern types a
 * rest pattern as an index signature.)
 *
 * @param {Powers['M']} M
 */
const makeShapes = M => {
  const { required, optional } = makeLessonShapes(M);
  const LessonShape = /** @type {CastedPattern<Lesson>} */ (
    M.splitRecord(required, optional, M.record())
  );
  const RecorderI = M.interface('Recorder', {
    record: M.call(LessonShape).returns(M.number()),
  });
  const ReaderI = M.interface('Reader', {
    lessons: M.call().optional(M.string()).returns(M.arrayOf(LessonShape)),
  });
  return harden({ RecorderI, ReaderI });
};
/** @typedef {ReturnType<typeof makeShapes>} Shapes */
/** @typedef {TypeFromInterfaceGuard<Shapes['RecorderI']>} Recorder what a reviewer records lessons with */
/** @typedef {TypeFromInterfaceGuard<Shapes['ReaderI']>} Reader what a categorizer reads lessons with */

/** @type {Put} */
const put = (store, key, value) =>
  store.has(key) ? store.set(key, value) : store.init(key, value);

/** @type {Update} */
const update = (store, key, f) => {
  const value = f(store.has(key) ? store.get(key) : undefined);
  put(store, key, value);
  return value;
};

/** @satisfies {BuildRootObject} */
export const buildRootObject = ({ Far, M, zone }) => {
  const { RecorderI, ReaderI } = makeShapes(M);
  /** @type {MapStore<'lesson', number>} */
  const counters = zone.mapStore('counters');
  /** @type {MapStore<number, Lesson>} by number */
  const lessons = zone.mapStore('lessons');
  /** @type {MapStore<string, number[]>} each normalized description's lessons, oldest first */
  const byDescription = zone.mapStore('byDescription');

  /** @type {Recorder} the guard's types, so the methods agree with what it checks */
  const recorderMethods = {
    /** Keep what a reviewer decided about a proposal. */
    record(lesson) {
      const n = update(counters, 'lesson', (n = 0) => n + 1);
      lessons.init(n, harden({ ...lesson }));
      const key = normal(lesson.description);
      update(byDescription, key, (ns = []) => harden([...ns, n]));
      return n;
    },
  };
  const makeRecorder = zone.exoClass(
    'Recorder',
    RecorderI,
    () => ({}),
    recorderMethods,
  );

  /** @type {Reader} the guard's types, so the methods agree with what it checks */
  const readerMethods = {
    /** Lessons, newest first: those about `description` if given, else all. */
    lessons(description) {
      if (description === undefined)
        return harden(
          [...lessons.entries()]
            .sort(([a], [b]) => b - a)
            .map(([, lesson]) => lesson),
        );
      const key = normal(description);
      const ns = byDescription.has(key) ? byDescription.get(key) : [];
      return harden([...ns].reverse().map(n => lessons.get(n)));
    },
  };
  const makeReader = zone.exoClass(
    'Reader',
    ReaderI,
    () => ({}),
    readerMethods,
  );

  const recorder = zone.makeOnce('recorder', () => makeRecorder());
  const reader = zone.makeOnce('reader', () => makeReader());
  return Far('lessons', {
    getRecorder: () => recorder,
    getReader: () => reader,
  });
};
/** @typedef {ReturnType<typeof buildRootObject>} Lessons the vat's root */
