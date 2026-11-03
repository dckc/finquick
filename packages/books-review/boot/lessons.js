/**
 * What reviewers decided, kept across books: each book snapshot gets its own
 * books, reviewer, and categorizer vats, but what a person taught one
 * categorizer, every later one should know.
 *
 * A reviewer gets the recorder; a categorizer, the reader. Neither can do
 * the other's part.
 */
/**
 * @import { BuildRootObject, MapStore } from '@vattr/toybox/types.ts';
 * @import { Lesson } from '../types.ts';
 */

/** A description as lessons match it: case and surrounding space aside. @param {string} d */
const normal = d => d.trim().toUpperCase();

const STATUSES = ['accepted', 'corrected', 'rejected'];

/** @type {BuildRootObject} */
export const buildRootObject = ({ Far, M, zone }) => {
  /** @type {MapStore<string, number>} */
  const counters = zone.mapStore('counters');
  /** @type {MapStore<number, Lesson>} by number */
  const lessons = zone.mapStore('lessons');
  /** @type {MapStore<string, number[]>} each normalized description's lessons, oldest first */
  const byDescription = zone.mapStore('byDescription');

  const makeRecorder = zone.exoClass(
    'Recorder',
    M.interface('Recorder', {
      record: M.call(
        M.splitRecord({ description: M.string(), status: M.string() }),
      ).returns(M.number()),
    }),
    () => ({}),
    {
      /** Keep what a reviewer decided about a proposal. @param {Lesson} lesson */
      record(lesson) {
        if (!STATUSES.includes(lesson.status))
          throw Error('a lesson has a decided status');
        const n = counters.has('lesson') ? counters.get('lesson') + 1 : 1;
        if (counters.has('lesson')) counters.set('lesson', n);
        else counters.init('lesson', n);
        lessons.init(n, harden({ ...lesson }));
        const key = normal(lesson.description);
        if (byDescription.has(key))
          byDescription.set(key, harden([...byDescription.get(key), n]));
        else byDescription.init(key, harden([n]));
        return n;
      },
    },
  );

  const makeReader = zone.exoClass(
    'Reader',
    M.interface('Reader', {
      lessons: M.call().optional(M.string()).returns(M.array()),
    }),
    () => ({}),
    {
      /**
       * Lessons, newest first: those about `description` if given, else all.
       *
       * @param {string} [description]
       * @returns {Lesson[]}
       */
      lessons(description) {
        if (description === undefined)
          return harden(
            lessons
              .entries()
              .sort(([a], [b]) => b - a)
              .map(([, lesson]) => lesson),
          );
        const key = normal(description);
        const ns = byDescription.has(key) ? byDescription.get(key) : [];
        return harden([...ns].reverse().map(n => lessons.get(n)));
      },
    },
  );

  const recorder = zone.makeOnce('recorder', () => makeRecorder());
  const reader = zone.makeOnce('reader', () => makeReader());
  return Far('lessons', {
    getRecorder: () => recorder,
    getReader: () => reader,
  });
};
