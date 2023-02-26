// @ts-check

/** @typedef {import('better-sqlite3').Database} SqliteDB */

const { freeze, keys } = Object;

/**
 * @param {string[]} fields
 * @param {string} [sep]
 */
const clause = (fields, sep = ', ') =>
  fields.map(n => `${n} = :${n}`).join(sep);

/** @param {SqliteDB} db */
export const makeORM = db => {
  const self = freeze({
    query: (table, keyFields = {}) => {
      const stmt = db.prepare(`
      select * from ${table}
      where ${
        keys(keyFields).length > 0
          ? clause([...keys(keyFields)], ' and ')
          : '1=1'
      }
    `);
      return stmt.all(keyFields);
    },
    /**
     * @param {string} table
     * @param {Record<string, unknown>} keyFields
     */
    lookup: (table, keyFields) =>
      freeze({
        get: () => {
          const stmt = db.prepare(`
            select * from ${table}
            where ${clause([...keys(keyFields)], ' and ')}
          `);
          return stmt.get(keyFields);
        },
        /** @param {Record<string, unknown>} dataFields */
        update: dataFields => {
          const stmt = db.prepare(`
            update ${table}
            set ${clause([...keys(dataFields)])}
            where ${clause([...keys(keyFields)], ' and ')}
          `);
          stmt.run({ ...dataFields, ...keyFields });
        },
      }),
    /**
     * @param {string} table
     * @param {Record<string, unknown>} fields
     */
    insert: (table, fields) => {
      const names = [...keys(fields)];
      const params = names.map(n => `:${n}`).join(', ');
      const stmt = db.prepare(`
        insert into ${table} (${names.join(', ')}) values (${params})`);
      stmt.run(fields);
    },
    /**
     * @param {string} table
     * @param {Record<string, unknown>} keyFields
     * @param {Record<string, unknown>} dataFields
     */
    upsert: (table, keyFields, dataFields) => {
      const it = self.lookup(table, keyFields);
      const v = it.get();
      if (v) {
        it.update(dataFields);
        return;
      }
      self.insert(table, { ...keyFields, ...dataFields });
    },
  });
  return self;
};
