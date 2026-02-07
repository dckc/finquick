import type { Database } from 'better-sqlite3';
import type { SqlDatabase, SqlStatement } from './sql-db.js';

type BetterSqliteStatement = {
  run: (...args: any[]) => unknown;
  get: (...args: any[]) => unknown;
  all: (...args: any[]) => unknown;
};

const wrapStatement = <TParams extends unknown[] = unknown[], TRow = unknown>(
  statement: BetterSqliteStatement,
): SqlStatement<TParams, TRow> => {
  const call = (method: keyof BetterSqliteStatement, params: unknown[]) => {
    if (params.length === 0) {
      return statement[method]();
    }
    if (params.length === 1) {
      return statement[method](params[0]);
    }
    return statement[method](params);
  };
  return {
    run: (...params: unknown[]) => call('run', params),
    get: (...params: unknown[]) => call('get', params) as TRow | undefined,
    all: (...params: unknown[]) => call('all', params) as TRow[],
  };
};

export const wrapBetterSqlite3Database = (db: Database): SqlDatabase => ({
  exec: (sql: string) => {
    db.exec(sql);
  },
  prepare: <TParams extends unknown[] = unknown[], TRow = unknown>(sql: string) =>
    wrapStatement<TParams, TRow>(db.prepare(sql) as BetterSqliteStatement),
});
