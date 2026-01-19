export type SqlStatement<TParams extends unknown[] = unknown[], TRow = unknown> = {
  run: (...params: any[]) => any;
  get: (...params: any[]) => TRow | undefined;
  all: (...params: any[]) => TRow[];
};

export type SqlDatabase = {
  exec: (sql: string) => void;
  prepare: <TParams extends unknown[] = unknown[], TRow = unknown>(
    sql: string,
  ) => SqlStatement<TParams, TRow>;
};
