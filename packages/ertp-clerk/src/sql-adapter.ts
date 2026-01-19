import type { SqlDatabase } from '../../ertp-ledgerguise/src/index.js';

type SqlCursor<T = Record<string, unknown>> = {
  next: () => IteratorResult<T>;
  toArray: () => T[];
  one: () => T;
  raw: () => SqlCursor<unknown[]>;
};

type SqlStorage = {
  exec: (sql: string, ...params: unknown[]) => SqlCursor;
};

const runExec = (sql: SqlStorage, statement: string, params: unknown[]) => {
  sql.exec(statement, ...params);
};

const toArray = <T>(sql: SqlStorage, statement: string, params: unknown[]) =>
  sql.exec(statement, ...params).toArray() as T[];

const one = <T>(sql: SqlStorage, statement: string, params: unknown[]) => {
  const rows = toArray<T>(sql, statement, params);
  return rows[0];
};

export const makeSqlDatabaseFromStorage = (sql: SqlStorage): SqlDatabase => ({
  exec: (statement: string) => {
    sql.exec(statement);
  },
  prepare: <TParams extends unknown[] = unknown[], TRow = unknown>(statement: string) => ({
    run: (...params: TParams) => runExec(sql, statement, params),
    get: (...params: TParams) => one<TRow>(sql, statement, params),
    all: (...params: TParams) => toArray<TRow>(sql, statement, params),
  }),
});
