/* eslint-disable no-continue */
// @ts-check

const { entries, keys } = Object;

/**
 * @param {string[]} args
 * @param {Object} io
 * @param {typeof import('better-sqlite3')} io.sqlite3
 * @param {typeof import('fs/promises').readFile} io.readFile
 */
const main = async (args, { sqlite3, readFile }) => {
  const [src, dest] = args;
  if (!src || !dest) throw Error(`usage: loadTables src.json dest.db`);

  const txt = await readFile(src, 'utf-8');
  const { tables } = JSON.parse(txt);
  const db = sqlite3(dest, {});
  for (const [name, rows] of entries(tables)) {
    console.info({ name, rows: rows.length });
    if (rows.length === 0) continue;

    const columns = keys(rows[0]);
    const bindings = columns.map(c => `@${c}`).join(', ');
    const dml = `insert into ${name}_load (${columns.join(
      ', ',
    )}) values (${bindings})`;
    console.log(dml);

    db.prepare(`drop table if exists ${name}_load`).run();
    db.prepare(
      `create table ${name}_load as select * from ${name} where 1=0`,
    ).run();

    const insert = db.prepare(dml);
    for (const row of rows) insert.run(row);
  }
};

/* global require, module, process */
if (require.main === module) {
  main(process.argv.slice(2), {
    // eslint-disable-next-line global-require
    sqlite3: require('better-sqlite3'),
    // eslint-disable-next-line global-require
    readFile: require('fs').promises.readFile,
  }).catch(console.error);
}
