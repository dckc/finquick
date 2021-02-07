// @ts-check

import ical from 'ical';
import requireText from 'require-text';
import * as jsonpatch from 'fast-json-patch';

import { asPromise } from './asPromise';
import { WebApp } from './WebApp';
import { check } from './check';

const { freeze, fromEntries, entries, keys, values } = Object;

const CONFIG = {
  owners: {
    'dan@dm93.org': 'EB:Dad',
    'mary@dm93.org': 'EB:Mom',
  },
  codes: {
    'EB:Dad': '6536',
    'EB:Mom': '6535',
  },
};

/**
 * @param {string[]} argv
 * @param {{
 *   stdout: typeof process.stdout,
 *   readFile: typeof import('fs').promises.readFile,
 *   env: typeof process.env,
 *   mysql: typeof import('mysql'),
 *   https: typeof import('follow-redirects').https,
 *   require: typeof require,
 * }} io
 */
async function main(argv, { stdout, mysql, env, require, https, readFile }) {
  const load = fn => readFile(fn, 'utf-8').then(txt => JSON.parse(txt));
  const pprint = obj => stdout.write(JSON.stringify(obj, null, 2));

  function mkBook() {
    return GCBook(
      mysql.createConnection({
        host: env.GC_HOST,
        user: env.GC_USER,
        password: env.GC_PASS,
        database: env.GC_DB,
      }),
      specifier => requireText(specifier, require),
    );
  }

  function mkCal() {
    const { DOMAIN, DEPLOYMENT_ID } = env;
    const execUrl = `https://script.google.com/a/${DOMAIN}/macros/s/${DEPLOYMENT_ID}/exec`;

    return BRGCal(
      WebApp(check.notNull(env.CAL_URL), { https }),
      WebApp(execUrl, { https }),
    );
  }

  if (argv.includes('--sync')) {
    const gc = mkBook();
    const aCal = mkCal();
    console.log('fetch from db, calendar...');
    const [txsGC, txsCal] = await Promise.all([gc.unCat(), aCal.txs()]);
    const {
      cal: { POST, DELETE },
      db: { UPDATE },
    } = sync(txsGC, txsCal);
    const [calres, dbres] = await Promise.all([
      aCal.edit({ POST, DELETE }),
      gc.update({ UPDATE }),
    ]);
    gc.close();
    pprint({ calendar: calres, db: dbres });
  }

  if (argv.includes('--cmp')) {
    const [fn1, fn2] = argv.slice(argv.indexOf('--cmp') + 1);
    console.log({ fn1, fn2 });
    const [txs1, txs2] = await Promise.all([fn1, fn2].map(load));
    const patch = compareTxs(txs1, txs2);
    pprint(patch);
  }

  if (argv.includes('--db')) {
    const gc = mkBook();
    pprint(await gc.unCat());
    gc.close();
  }

  if (argv.includes('--curl')) {
    pprint(await mkCal().txs());
  }
}

/**
 * @param {Record<string, Tx>} txsGC
 * @param {Record<string, Tx>} txsCal
 */
function sync(txsGC, txsCal) {
  const dbKeys = keys(txsGC);
  const calKeys = keys(txsCal);
  console.log('fetched:', {
    db: dbKeys.length,
    calendar: calKeys.length,
  });

  const toPost = values(txsGC).filter(
    ({ tx_guid }) => !calKeys.includes(tx_guid),
  );
  const toDelete = values(txsCal)
    .filter(({ tx_guid }) => !dbKeys.includes(tx_guid))
    .map(({ tx_date, tx_guid }) => ({
      day: tx_date,
      tx_guid,
    }));
  const toUpdate = values(txsCal)
    .filter(
      ({ tx_guid, acct_path }) =>
        dbKeys.includes(tx_guid) && typeof acct_path === 'string',
    )
    .map(tx => ({ ...tx, code: CONFIG.codes[tx.acct_path] }));
  return {
    cal: { POST: toPost, DELETE: toDelete },
    db: { UPDATE: toUpdate },
  };
}

const mapValues = (obj, f) =>
  fromEntries(entries(obj).map(([prop, val]) => [prop, f(val)]));

/**
 * @typedef {{
 *   tx_date: string,
 *   description?: string,
 *   amount?: number,
 *   memo?: string,
 *   memo_acct?: string,
 *   tx_guid: string,
 *   acct_path?: string,
 *   code?: string,
 *   online_id: string,
 * }} Tx
 */

/**
 * @param {Record<string, Tx>} txs1
 * @param {Record<string, Tx>} txs2
 */
function compareTxs(txs1, txs2) {
  // ISSUE: is amount essential?
  const essential = ({ tx_date, tx_guid, acct_path }) => ({
    tx_date,
    tx_guid,
    ...(acct_path ? { acct_path } : {}),
  });
  const [txs1e, txs2e] = [txs1, txs2].map(txs => mapValues(txs, essential));
  const patch = jsonpatch.compare(txs1e, txs2e);
  const fullValue = id => txs2[id];
  return patch.map(op =>
    op.op === 'add' && op.value.tx_guid
      ? { ...op, value: fullValue(op.value.tx_guid) }
      : op,
  );
}

/** @type {(text: string) => Record<string, string>} */
function sqlStatements(text) {
  /** @type {Record<string, string>} */
  const byName = {};
  /** @type {(lo: number, hi: number) => string} */
  const chop = (lo, hi) => text.substring(lo, hi).replace(/;\s*$/, '');
  let pos = 0;
  let name;
  for (const m of text.matchAll(/^-- (?<name>[^:]+):\n/gm)) {
    if (name) {
      byName[name] = chop(pos, m.index || -1);
    }
    pos = m.index || -1;
    name = check.notNull(m.groups).name;
  }
  if (name && pos < text.length) {
    byName[name] = chop(pos, text.length);
  }
  return byName;
}

/**
 * GnuCash Book
 *
 * @param {Connection} conn
 * @param { (specifier: string) => string } requireText
 * @typedef {import('mysql').Connection} Connection
 */
function GCBook(conn, requireText) {
  const sql = sqlStatements(requireText('./book_ops.sql'));
  const exec = (/** @type {string} */ sql, params = []) =>
    asPromise(cb => conn.query(sql, params, cb));

  return freeze({
    /**
     * Uncategorized transactions
     *
     * @returns {Promise<Record<string, Tx>>}
     */
    async unCat() {
      const txs = await exec(sql.uncat);
      const byGuid = fromEntries(txs.map(tx => [tx.tx_guid, tx]));
      return byGuid;
    },
    /**
     * @param {{ UPDATE: Tx[] }} info
     */
    async update({ UPDATE }) {
      console.log('updating', UPDATE.length);
      await Promise.all(
        UPDATE.map(({ tx_guid, code }) =>
          exec(sql.updateSplitAccounts, [code, tx_guid]),
        ),
      );
      return UPDATE.length;
    },
    async close() {
      // @ts-ignore
      return asPromise(cb => conn.end(cb));
    },
  });
}

/**
 * Google Calendar for Budget Review
 * @param {ReturnType<WebApp>} readICS
 * @param {ReturnType<WebApp>} editApp
 */
function BRGCal(readICS, editApp) {
  /** @type { (event: any) => Tx } */
  function txOfEvent(event) {
    const { tx_guid, online_id } = JSON.parse(event.description);
    const tx_date = event.start.toISOString().slice(0, 10);
    return { tx_guid, tx_date, online_id, ...expenseAccount(event) };
  }

  function expenseAccount(event) {
    const accepted = event.attendee.find(
      ({ params: { PARTSTAT } }) => PARTSTAT === 'ACCEPTED',
    );
    const mbox = url => url.replace(/^mailto:/, '');
    return accepted ? { acct_path: CONFIG.owners[mbox(accepted.val)] } : {};
  }

  return freeze({
    editUrl: editApp.url,
    /** @type {() => Promise<Record<string, Tx>>} */
    async txs() {
      const txt = await readICS.get();
      const cal = ical.parseICS(txt);
      // pprint(cal);
      return fromEntries(
        values(cal)
          .map(txOfEvent)
          .map(tx => [tx.tx_guid, tx]),
      );
    },
    /**
     * @param {{POST: Tx[], DELETE: {day: string, tx_guid: string}[]}} edits
     */
    async edit({ POST, DELETE }) {
      console.log('edit', {
        POST: POST.length,
        DELETE: DELETE.length,
        editUrl: editApp.url,
      });
      if (!(POST.length > 0 || DELETE.length > 0)) {
        return undefined;
      }
      const payload = JSON.stringify({ POST, DELETE });
      return editApp.post(payload).then(JSON.parse);
    },
  });
}

if (require.main === module) {
  main(process.argv, {
    stdout: process.stdout,
    readFile: require('fs').promises.readFile,
    mysql: require('mysql'),
    https: require('follow-redirects').https,
    env: process.env,
    require: require,
  }).catch(err => {
    console.error(err);
  });
}
