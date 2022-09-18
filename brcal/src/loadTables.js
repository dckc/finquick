/* eslint-disable no-continue */
// @ts-check
const { pipeline } = require('stream');
const csv = require('csv-parse');

const { entries, fromEntries, keys } = Object;

/**
 * @param {ReturnType<typeof import('better-sqlite3')>} db
 * @param {Record<string, Record<string, string>[]>} tables see grokBalanceSheet.js
 */
const loadBalanceSheet = async (db, tables) => {
  for (const [name, rows] of entries(tables)) {
    console.info({ name, rows: rows.length });
    if (rows.length === 0) continue;

    const columns = keys(rows[0]);
    const dml = insertDML(columns, name);
    console.log(dml);

    db.prepare(`drop table if exists ${name}_load`).run();
    db.prepare(
      `create table ${name}_load as select * from ${name} where 1=0`,
    ).run();

    const insert = db.prepare(dml);
    for (const row of rows) insert.run(row);
  }
};

const USAGE = `Usage:
 loadTables --tsv schema.csv dataDir dest.db

or load output of grokBalanceSheet.js:
 loadTables src.json dest.db
`;

/** @type { <X, Y>(xs: X[], ys: Y[]) => [X, Y][]} */
const zip = (xs, ys) => xs.map((x, i) => [x, ys[+i]]);

const asRecords = (rows) => {
  const [hd, ...rest] = rows;
  return rest.map((row) => fromEntries(zip(hd, row)));
};

const insertDML = (columns, name) => {
  const bindings = columns.map((c) => `?`).join(', ');
  const dml = `insert into ${name}_load (${columns.join(
    ', ',
  )}) values (${bindings})`;
  return dml;
};

function* groupBy(items, getKey) {
  let group = [];
  let groupKey = undefined;
  for (const item of items) {
    const itemKey = getKey(item);
    if (groupKey !== undefined) {
      if (itemKey !== groupKey) {
        yield [groupKey, group];
        group = [];
      }
    }
    groupKey = itemKey;
    group.push(item);
  }
  if (group.length > 0) {
    yield [groupKey, group];
  }
}

const logged = (x) => {
  console.log('@@@', x);
  return x;
};

/**
 * TODO: refactor as readLines, map JSON.parse
 *
 * @param {AsyncIterable<Buffer>} data
 * @yields { unknown }
 */
async function* readTSV(data) {
  let buf = '';
  let line = '';
  for await (const chunk of data) {
    buf += chunk;
    for (let pos = buf.indexOf('\n'); pos >= 0; pos = buf.indexOf('\n')) {
      line += buf.slice(0, pos);
      if (line.endsWith('\\')) {
        line = line.slice(0, line.length - 1);
      } else {
        const raw = [];
        while (line.length > 0) {
          const parts = line.match(/^\t?([^\\\t]|\\[\s\S])*/);
          if (!parts) throw RangeError(line);
          const [part] = parts;
          raw.push(part.replace(/^\t/, ''));
          line = line.slice(part.length);
        }
        const row = raw.map((v) =>
          v === '\\N' ? null : v.replace(/\\(.)/g, '$1'),
        );
        yield row;
        line = '';
      }
      buf = buf.slice(pos + 1);
    }
  }
}

/**
 *
 * @param {ReturnType<typeof import('better-sqlite3')>} db
 * @param {Record<string, string>[]} schema
 * @param {(name: string) => import('fs').ReadStream} readData
 * @param {*} [opts]
 */
const loadDataFiles = async (
  db,
  schema,
  readData,
  opts = { delimiter: '\t', relax_column_count: true, quote: false },
) => {
  const columnInfo = schema.map(
    ({ TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION }) => ({
      ORDINAL_POSITION: Number(ORDINAL_POSITION),
      TABLE_NAME,
      COLUMN_NAME,
    }),
  );
  const tableInfo = [...groupBy(columnInfo, (c) => c.TABLE_NAME)];
  db.pragma('journal_mode = WAL');
  for (const [name, columns] of tableInfo) {
    // console.log({ name });
    const dml = insertDML(
      columns.map((c) => c.COLUMN_NAME),
      name,
    );
    console.warn(dml);

    db.prepare(`drop table if exists ${name}_load`).run();
    db.prepare(
      `create table ${name}_load as select * from ${name} where 1=0`,
    ).run();

    const insert = db.prepare(dml);

    const rs = readData(name);
    let qty = 0;
    for await (const row of readTSV(rs)) {
      // console.debug({ dml, row });
      try {
        insert.run(row);
      } catch (e) {
        console.error({ row }, e);
        throw e;
      }
      qty += 1;
    }
    console.warn({ name, qty });
    db.prepare(`delete from ${name}`).run();
    db.prepare(`insert into ${name} select * from ${name}_load`).run();
    db.prepare(`drop table ${name}_load`).run();
  }
};

/**
 * @param {string[]} args
 * @param {Object} io
 * @param {typeof import('better-sqlite3')} io.sqlite3
 * @param {typeof import('fs/promises').readFile} io.readFile
 * @param {typeof import('fs').createReadStream} io.createReadStream
 * @param {typeof import('path').join} io.pathJoin
 */
const main = async (
  args,
  { sqlite3, readFile, createReadStream, pathJoin },
) => {
  if (args.includes('--tsv')) {
    args.shift();
    const [schemaFileName, dataDir, dest] = args;
    if (!schemaFileName || !dataDir || !dest) throw Error(USAGE);
    const text = await readFile(schemaFileName, 'utf-8');
    /** @type { Record<string, string>[] } */
    const schema = await new Promise((resolve, reject) =>
      csv.parse(text, { columns: true }, (err, records) =>
        err ? reject(err) : resolve(records),
      ),
    );
    console.warn({ dest });
    const db = sqlite3(dest, {});

    return loadDataFiles(db, schema, (name) => {
      const path = pathJoin(dataDir, `${name}.txt`);
      // console.debug({ name, path });
      return createReadStream(path);
    });
  }

  const [src, dest] = args;
  if (!src || !dest) throw Error(USAGE);

  const txt = await readFile(src, 'utf-8');
  const { tables } = JSON.parse(txt);
  const db = sqlite3(dest, {});
  await loadBalanceSheet(db, tables);
};

/* global require, module, process */
if (require.main === module) {
  main(process.argv.slice(2), {
    // eslint-disable-next-line global-require
    sqlite3: require('better-sqlite3'),
    // eslint-disable-next-line global-require
    readFile: require('fs').promises.readFile,
    // eslint-disable-next-line global-require
    createReadStream: require('fs').createReadStream,
    pathJoin: require('path').join,
  }).catch(console.error);
}
