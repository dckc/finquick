#!/usr/bin/env node
// @ts-check
/**
 * mail-cache: save what a mailQuery webkey shows as .eml files.
 *
 *   node scripts/mail-cache.js WEBKEY_FILE OUT_DIR
 *
 * WEBKEY_FILE holds the webkey (keep it 0600); nothing else here knows
 * it. Each message is saved once, as its raw RFC 822, named by date,
 * subject and Gmail id, and never rewritten: a message doesn't change.
 * OUT_DIR/threads.json is what the query found this time.
 *
 * Copyright (C) 2026 by Dan Connolly
 * SPDX-License-Identifier: Apache-2.0
 */
import * as fsp from 'node:fs/promises';
import * as nodePath from 'node:path';

/**
 * @param {string} webkey
 * @returns {{ base: string, s: string }}
 */
export const parseWebkey = webkey => {
  const [base, fragment] = webkey.trim().split('#');
  const s = new URLSearchParams(fragment || '').get('s');
  if (!base.startsWith('https://') || !s) throw Error('expected https://...#s=...');
  return { base, s };
};

/** @param {string} text */
const slug = text =>
  (text || 'no subject')
    .normalize('NFKD')
    .replace(/[^\w]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .toLowerCase();

/**
 * @param {{ id: string, date?: string, subject?: string }} m
 */
export const fileName = m => {
  const when = new Date(m.date || '');
  const day = isNaN(when.getTime()) ? 'undated' : when.toISOString().slice(0, 10);
  return `${day}-${slug(m.subject || '')}-${m.id}.eml`;
};

/**
 * @param {string} webkey
 * @param {typeof fetch} fetch
 */
export const makeClient = (webkey, fetch) => {
  const { base, s } = parseWebkey(webkey);
  /** @param {string} method @param {unknown[]} args */
  const call = async (method, args = []) => {
    // text/plain: Apps Script reads the body as is, and answers by redirect
    const res = await fetch(base, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ s, method, args }),
    });
    if (!res.ok) throw Error(`${method}: HTTP ${res.status}`);
    const reply = await res.json();
    if ('error' in reply) throw Error(`${method}: ${reply.error}`);
    return reply.ok;
  };
  return Object.freeze({
    threads: () => call('threads'),
    /** @param {string} id */
    raw: async id => {
      const { raw } = await call('raw', [id]);
      return Buffer.from(raw, 'base64'); // takes base64url too
    },
  });
};

/**
 * @param {ReturnType<typeof makeClient>} client
 * @param {string} out
 * @param {{ fs: Pick<typeof import('node:fs/promises'), 'readdir' | 'writeFile' | 'mkdir'>,
 *   path: Pick<typeof import('node:path'), 'join'> }} io
 */
export const cacheMail = async (client, out, { fs, path }) => {
  const found = await client.threads();
  await fs.mkdir(out, { recursive: true });
  const have = new Set(
    (await fs.readdir(out)).flatMap(f => f.match(/-([0-9a-f]+)\.eml$/)?.slice(1) || []),
  );
  const saved = [];
  for (const t of found.threads) {
    for (const m of t.messages) {
      if (have.has(m.id)) continue;
      const name = fileName(m);
      await fs.writeFile(path.join(out, name), await client.raw(m.id), { flag: 'wx' });
      saved.push(name);
    }
  }
  await fs.writeFile(path.join(out, 'threads.json'), `${JSON.stringify(found, null, 2)}\n`);
  return { found, saved };
};

/**
 * @param {string[]} [argv]
 * @param {{ fs?: typeof fsp, path?: typeof nodePath, fetch?: typeof fetch }} [io]
 */
const main = async (
  argv = process.argv.slice(2),
  { fs = fsp, path = nodePath, fetch = globalThis.fetch } = {},
) => {
  const [keyFile, out] = argv;
  if (!keyFile || !out) throw Error('usage: mail-cache.js WEBKEY_FILE OUT_DIR');
  const client = makeClient(await fs.readFile(keyFile, 'utf8'), fetch);
  const { found, saved } = await cacheMail(client, out, { fs, path });
  const count = found.threads.reduce((n, t) => n + t.messages.length, 0);
  console.log(`${found.query}: ${found.threads.length} threads, ${count} messages, ${saved.length} new`);
  for (const name of saved) console.log(`  ${name}`);
  if (found.more) console.log('  (more threads than maxThreads; not all shown)');
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
