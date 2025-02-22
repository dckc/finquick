// @ts-check

/** @import {Database as SqliteDB} from 'better-sqlite3'  */

const { freeze, keys } = Object;

/**
 * @param {string[]} fields
 * @param {string} [sep]
 */
const clause = (fields, sep = ', ') =>
  fields.map(n => `${n} = :${n}`).join(sep);

/**
 * @template {Record<string, Record<string, any>>} DB
 * @param {SqliteDB} db
 */
export const makeORM = db => {
  const self = freeze({
    /**
     * @template {string & keyof DB} TN
     * @param {TN} table
     * @param {Record<string, unknown>} keyFields
     * @returns {DB[TN][]}
     */
    query: (table, keyFields = {}) => {
      const stmt = db.prepare(`
      select * from ${table}
      where ${
        keys(keyFields).length > 0
          ? clause([...keys(keyFields)], ' and ')
          : '1=1'
      }
    `);
      // @ts-expect-error ASSUME DB[table] type
      return stmt.all(keyFields);
    },
    /**
     * @template {string & keyof DB} TN
     * @param {TN} table
     * @param {Partial<DB[table]>} keyFields
     */
    lookup: (table, keyFields) =>
      freeze({
        /**
         * @returns {DB[TN]}
         */
        get: () => {
          const stmt = db.prepare(`
            select * from ${table}
            where ${clause([...keys(keyFields)], ' and ')}
          `);
          // @ts-expect-error ASSUME DB[table] type
          return stmt.get(keyFields);
        },
        /** @param {Partial<DB[TN]>} dataFields */
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
     * @template {string & keyof DB} TN
     * @param {TN} table
     * @param {Partial<DB[TN]>} fields
     */
    insert: (table, fields) => {
      const names = [...keys(fields)];
      const params = names.map(n => `:${n}`).join(', ');
      const stmt = db.prepare(`
        insert into ${table} (${names.join(', ')}) values (${params})`);
      stmt.run(fields);
    },
    /**
     * @template {string & keyof DB} TN
     * @param {TN} table
     * @param {Partial<DB[TN]>} keyFields
     * @param {Partial<DB[TN]>} dataFields
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
