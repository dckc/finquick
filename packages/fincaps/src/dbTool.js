// @ts-check
import { Far } from '@endo/far';
import sqlAmbient from 'better-sqlite3';

/** @typedef {import('better-sqlite3').Database} SqliteDB */

const { Fail } = assert;
const { keys } = Object;

/**
 * @param {string[]} fields
 * @param {string} [sep]
 */
const clause = (fields, sep = ', ') =>
  fields.map(n => `${n} = :${n}`).join(sep);

const pathToFields = path => {
  path.length % 1 === 0 || Fail`odd number of keys/values: ${path}`;
  let column;
  const fields = {};
  for (const item of path) {
    if (column) {
      fields[column] = item;
      column = undefined;
    } else {
      column = item;
    }
  }
  return fields;
};

/** @param {SqliteDB} db */
export const makeDBTool = db => {
  // TODO: defend against unexpected inputs

  /**
   * @param {string} table
   * @param {Record<string, unknown>} where
   */
  const getTable = (table, where = {}) => {
    harden(where);

    /** @satisfies {NameHub} */
    const rd = Far('TableRd', {
      info: () => ({ table, where }),

      // attenuation
      readOnly: () => rd,
      subTable: keyFields =>
        getTable(table, { ...where, ...keyFields }).readOnly(),
      lookup: (...path) => rd.subTable(pathToFields(path)),

      query: (keyFields = {}) => {
        keyFields = { ...keyFields, ...where };
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

      /** @param {Record<string, unknown>} keyFields */
      select1: keyFields =>
        Far('Row', {
          get: () => {
            keyFields = { ...keyFields, ...where };
            const stmt = db.prepare(`
            select * from ${table}
            where ${clause([...keys(keyFields)], ' and ')}
          `);
            return stmt.get(keyFields);
          },
          /** @param {Record<string, unknown>} dataFields */
          update: dataFields => {
            keyFields = { ...keyFields, ...where };
            const stmt = db.prepare(`
            update ${table}
            set ${clause([...keys(dataFields)])}
            where ${clause([...keys(keyFields)], ' and ')}
          `);
            // TODO: limit 1?
            stmt.run({ ...dataFields, ...keyFields });
          },
        }),
    });

    /** @satisfies {NameHub} */
    const wr = Far('TableRdWr', {
      ...rd,

      readOnly: () => rd,
      subTable: keyFields => getTable(table, { ...where, ...keyFields }),
      lookup: (...path) => wr.subTable(pathToFields(path)),

      /** @param {Record<string, unknown>} fields */
      insert: fields => {
        fields = { fields, ...where };
        const names = [...keys(fields)];
        const params = names.map(n => `:${n}`).join(', ');
        const stmt = db.prepare(`
        insert into ${table} (${names.join(', ')}) values (${params})`);
        stmt.run(fields);
      },
      /**
       * @param {Record<string, unknown>} keyFields
       * @param {Record<string, unknown>} dataFields
       */
      upsert: (keyFields, dataFields) => {
        const it = wr.select1(keyFields);
        const v = it.get();
        if (v) {
          it.update(dataFields);
          return;
        }
        wr.insert({ ...keyFields, ...dataFields });
      },
    });

    return wr;
  };

  return Far('DBTool', {
    getTable,
    lookup: (...path) => {
      path.length >= 1 || Fail`no table name`;
      const [name, ...rest] = path;
      return getTable(name).lookup(...rest);
    },
  });
};
/** @typedef {ReturnType<makeDBTool>} DBTool */

export const make = async _guestP => {
  /** @satisfies {NameHub} */
  const hub = Far('DBHub', {
    lookup: async (...path) => {
      const [dbPath, ...rest] = path;
      const db = sqlAmbient(dbPath, pathToFields(rest));
      return makeDBTool(db);
    },
  });
  return hub;
};
