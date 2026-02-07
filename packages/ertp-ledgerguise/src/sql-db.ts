export type SqlStatement<
  TParams extends unknown[] = unknown[],
  TRow = unknown,
> = {
  run: (...params: TParams) => any;
  get: (...params: TParams) => TRow | undefined;
  all: (...params: TParams) => TRow[];
};

export type SqlDatabase = {
  exec: (sql: string) => void;
  prepare: <TParams extends unknown[] = unknown[], TRow = unknown>(
    sql: string,
  ) => SqlStatement<TParams, TRow>;
};
