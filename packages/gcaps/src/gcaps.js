// @ts-check
/**
 * gcaps: webkeys for narrow views of Google data, from Apps Script.
 *
 * A webkey is a URL whose fragment is the credential:
 *
 *   https://script.google.com/macros/s/<deployment>/exec#s=<swiss number>
 *
 * Browsers don't send the fragment, so it stays out of logs; programs
 * POST it in the body. This web app runs as its owner, so the script
 * holds the owner's Gmail authority (read-only, by its manifest), and a
 * webkey's holder gets only what one row of the Webkeys sheet says.
 *
 * Say the owner adds a row to the Webkeys sheet with the query
 * `label:agent roof claim` and the note `for Claude: hail roof`, selects
 * it, and picks Webkeys > Mint webkey for selected row. The row gets an
 * id, the SHA-256 of a new swiss number, and the owner gets the webkey,
 * once. Its holder can list the threads the query finds and fetch their
 * messages as raw RFC 822, and nothing else. Editing the query steers
 * the webkey; deleting the row (or its id) revokes it.
 *
 * So edit access to the sheet is authority to mint: keep it unshared.
 *
 * Authority flows down from the entry points in web.js and menu.js,
 * whose default arguments are the only code that names Apps Script's
 * globals:
 *
 *   web app:
 *     makeCapTable_({ sheet, digest, revive })   reads the Webkeys sheet
 *       .lookup(swiss) -> revive(query)          the authority, as its row says now
 *     makeMailQuery_({ gmail, base64 }, query)   reads Gmail; revive makes one
 *       .threads(), .raw(id)                     what a webkey can do
 *     invoke_(obj, method, args)                 call just one of those
 *   menu:
 *     makeMinter_({ sheet, digest, random, now })  writes the Webkeys sheet
 *       .mint(rowNum) -> { swiss }                 fill in a row's id
 *
 * Only the owner writes rows, so rows aren't checked at run time; what a
 * webkey's holder sends (swiss, method, args, id) is.
 *
 * Copyright (C) 2026 by Dan Connolly
 * SPDX-License-Identifier: Apache-2.0
 */

const { freeze } = Object;

/** @param {object} obj @param {PropertyKey} key */
const hasOwn_ = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const WEBKEYS = freeze({ sheetName: 'Webkeys', hd: freeze(['id', 'query', 'note', 'created']) });

const MAX_THREADS = 100;

const HEADERS = ['Date', 'From', 'To', 'Cc', 'Subject', 'Message-ID'];

/** @param {GmailHeader[] | undefined} list */
const headerMap_ = list => Object.fromEntries((list || []).map(({ name, value }) => [name, value]));

/**
 * The threads a Gmail query finds, and their messages.
 *
 * @param {object} powers
 * @param {GmailReader} powers.gmail
 * @param {(bytes: number[]) => string} powers.base64
 * @param {string} query
 */
const makeMailQuery_ = ({ gmail, base64 }, query) => {
  const search = () => {
    const { threads = [], nextPageToken } = gmail.Users.Threads.list('me', { q: query, maxResults: MAX_THREADS });
    return { ids: threads.map(t => t.id), more: !!nextPageToken };
  };

  return freeze({
    /** the query, and the threads it finds */
    threads() {
      const { ids, more } = search();
      const threads = ids
        .map(id => gmail.Users.Threads.get('me', id, { format: 'metadata', metadataHeaders: HEADERS }))
        .map(t => ({
          id: t.id,
          messages: t.messages.map(m => {
            const h = headerMap_(m.payload && m.payload.headers);
            return {
              id: m.id,
              date: h.Date,
              from: h.From,
              to: h.To,
              cc: h.Cc,
              subject: h.Subject,
              messageId: h['Message-ID'],
            };
          }),
        }));
      return { query, threads, more };
    },

    /**
     * one message as RFC 822 (base64), if its thread is one threads() shows
     * @param {unknown} id from the webkey's holder
     */
    raw(id) {
      if (typeof id !== 'string') throw Error('id: not a string');
      const { threadId, raw } = gmail.Users.Messages.get('me', id, { format: 'raw' });
      if (!threadId || !search().ids.includes(threadId) || raw === undefined) throw Error(`not found: ${id}`);
      return { id, threadId, raw: typeof raw === 'string' ? raw : base64(raw) };
    },
  });
};

/**
 * A webkey's id: the SHA-256 of its swiss number, in hex.
 *
 * @param {(s: string) => number[]} digest
 * @param {string} swiss
 */
const webkeyId_ = (digest, swiss) =>
  digest(swiss)
    .map(b => ((b + 256) % 256).toString(16).padStart(2, '0'))
    .join('');

/**
 * The Webkeys sheet's rows, and its columns by name: id, query, note,
 * created (in any order, below a header row).
 *
 * @param {Pick<WebkeysSheet, 'getDataRange'>} sheet
 */
const readWebkeys_ = sheet => {
  const [hd = [], ...rows] = sheet.getDataRange().getValues();
  /** @param {string} name */
  const col = name => {
    const ix = hd.indexOf(name);
    if (ix < 0) throw Error(`${WEBKEYS.sheetName}: no ${name} column`);
    return ix;
  };
  return { rows, col };
};

/**
 * The capability table, for the web app: from a swiss number to the
 * authority it designates, as its row says now.
 *
 * @template {object} T
 * @param {object} powers
 * @param {Pick<WebkeysSheet, 'getDataRange'> | null} powers.sheet
 * @param {(s: string) => number[]} powers.digest SHA-256, for ids
 * @param {(query: string) => T} powers.revive the authority a row's query designates
 */
const makeCapTable_ = ({ sheet, digest, revive }) => {
  if (!sheet) throw Error(`no ${WEBKEYS.sheetName} sheet`);
  return freeze({
    /** @param {unknown} swiss from the webkey's holder */
    lookup(swiss) {
      if (typeof swiss !== 'string' || !swiss) throw Error('no such webkey');
      const id = webkeyId_(digest, swiss);
      const { rows, col } = readWebkeys_(sheet);
      const row = rows.find(r => r[col('id')] === id);
      const query = row && String(row[col('query')]).trim();
      if (!query) throw Error('no such webkey');
      return revive(query);
    },
  });
};

/**
 * For the owner: give rows of the Webkeys sheet webkeys.
 *
 * @param {object} powers
 * @param {WebkeysSheet | null} powers.sheet
 * @param {(s: string) => number[]} powers.digest SHA-256, for ids
 * @param {() => string} powers.random a new swiss number
 * @param {() => Date} powers.now
 */
const makeMinter_ = ({ sheet, digest, random, now }) => {
  if (!sheet) throw Error(`no ${WEBKEYS.sheetName} sheet`);
  return freeze({
    /**
     * give a row with a query (and no id yet) an id; the swiss number is
     * the webkey's secret, so it's not kept
     * @param {number} rowNum 1-based, as in the sheet
     */
    mint(rowNum) {
      const { rows, col } = readWebkeys_(sheet);
      const row = rows[rowNum - 2];
      if (!row) throw Error(`row ${rowNum}: not a ${WEBKEYS.sheetName} row`);
      if (!String(row[col('query')]).trim()) throw Error(`row ${rowNum}: no query`);
      if (row[col('id')]) throw Error(`row ${rowNum} has a webkey; clear its id to make a new one`);
      const swiss = random();
      sheet.getRange(rowNum, col('id') + 1).setValue(webkeyId_(digest, swiss));
      sheet.getRange(rowNum, col('created') + 1).setValue(now().toISOString());
      return { swiss };
    },
  });
};

/**
 * Call one of an object's own methods, as a webkey's holder asks.
 *
 * @param {object} obj
 * @param {unknown} method from the webkey's holder
 * @param {unknown} args from the webkey's holder
 */
const invoke_ = (obj, method, args) => {
  if (typeof method !== 'string' || !hasOwn_(obj, method)) throw Error(`no such method: ${String(method)}`);
  if (!Array.isArray(args)) throw Error('args: not an array');
  const methods = /** @type {Record<string, (...args: unknown[]) => unknown>} */ (obj);
  return methods[method](...args);
};
