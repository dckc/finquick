// @ts-check
import { parseArgs } from 'node:util';
import { csv2ofx } from './csv2ofx.js';

/** @type { import('node:util').ParseArgsConfig['options'] } */
const options = /** @type {const} */ ({
  acctId: { type: 'string' },
});

export const Usage = 'cli --acctId I file.csv...';

/**
 * @param {string[]} args
 * @param {object} io
 * @param {Pick<typeof import('fs/promises'), 'readFile' | 'writeFile'>} io.fsp
 * @param {() => number} io.now
 */
const main = async (args, { fsp: { readFile, writeFile }, now }) => {
  const { positionals: paths, values } = parseArgs({
    args,
    options,
    allowPositionals: true,
  });
  const { acctId } = values;
  if (!(paths.length && acctId)) throw Usage;
  const dtServer = new Date(now());
  for await (const path of paths) {
    /** @type {string} */
    const content = await readFile(path, { encoding: 'utf-8' });
    const ofx = csv2ofx({ acctId, dtServer, content });
    const outPath = `${path}.ofx`;
    console.info('writing OFX to', outPath);
    await writeFile(outPath, ofx);
  }
};

main(process.argv.slice(2), {
  fsp: await import('node:fs/promises'),
  now: () => Date.now(),
}).catch(reason => {
  if (typeof reason === 'string') {
    console.error(reason);
  } else {
    console.error(reason);
  }
  process.exit(1);
});
