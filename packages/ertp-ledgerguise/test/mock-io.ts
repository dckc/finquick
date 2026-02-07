/**
 * @file Mock IO for deterministic testing.
 *
 * Provides mock versions of IO capabilities (clock, GUID generation, database)
 * for tests that need deterministic behavior.
 */

import Database from 'better-sqlite3';
import { initGnuCashSchema, wrapBetterSqlite3Database } from '../src/index.js';
import type { Guid } from '../src/types.js';

const asGuid = (value: string): Guid => value as Guid;

/**
 * Create a deterministic clock that advances by a fixed step on each call.
 */
export const makeTestClock = (
  startMs = Date.UTC(2020, 0, 1, 9, 15),
  stepDays = 3,
) => {
  const stepMs = stepDays * 24 * 60 * 60 * 1000;
  let now = startMs;
  return () => {
    const current = now;
    now += stepMs;
    return current;
  };
};

/**
 * Create a deterministic GUID generator that produces sequential hex strings.
 */
export const mockMakeGuid = (start: bigint = 0n): (() => Guid) => {
  let counter = start;
  return () => {
    const guid = counter;
    counter += 1n;
    return asGuid(guid.toString(16).padStart(32, '0'));
  };
};

/**
 * Create an in-memory GnuCash database for testing.
 * Returns the wrapped db and a close function for teardown.
 */
export const makeTestDb = () => {
  const rawDb = new Database(':memory:');
  const db = wrapBetterSqlite3Database(rawDb);
  initGnuCashSchema(db);
  return { db, close: () => rawDb.close() };
};
