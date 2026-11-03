#!/usr/bin/env node
/**
 * @file Assemble the books' boot directory: this package's vats, and the toybox vats they use.
 */
import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const { freeze } = Object;

const HELP = `usage: scripts/boot-dir.js DEST

Fills DEST (replacing what's there) with the boot directory a toybox runs
the books from: this package's boot/, and, vendored beside it, the toybox
vats it makes (the WebApp maker, kvats/webapp.js), from the toybox this
package depends on.
`;

/** This package's directory. */
export const here = new URL('..', import.meta.url).pathname;

/** The toybox vats the books use, by their names in the boot directory. */
export const VENDORED = freeze({ 'webapp.js': 'kvats/webapp.js' });

/**
 * @param {object} io
 * @param {typeof cp} io.cp
 * @param {typeof mkdir} io.mkdir
 * @param {typeof rm} io.rm
 * @param {string} toybox the toybox package's directory
 */
export const makeBootDir =
  ({ cp, mkdir, rm }, toybox) =>
  /** @param {string} dest */
  async dest => {
    await rm(dest, { recursive: true, force: true });
    await mkdir(dest, { recursive: true });
    await cp(join(here, 'boot'), dest, { recursive: true });
    for (const [name, from] of Object.entries(VENDORED))
      await cp(join(toybox, from), join(dest, name));
    return dest;
  };

/** The toybox package this one depends on. */
export const toyboxDir = () =>
  new URL('../node_modules/@vattr/toybox/', import.meta.url).pathname;

/**
 * @param {object} [io]
 * @param {string[]} [io.args]
 * @param {(text: string) => void} [io.print]
 */
export const main = async ({
  args = process.argv.slice(2),
  print = text => void process.stdout.write(text),
} = {}) => {
  if (args.length !== 1 || args[0].startsWith('-')) return print(HELP);
  await makeBootDir({ cp, mkdir, rm }, toyboxDir())(args[0]);
};

if (process.argv[1] === new URL(import.meta.url).pathname) await main();
