// @ts-check
/** @typedef {'children' | 'data'} AgoricChainStoragePathKind */
/** @template T @typedef {import('@endo/marshal').FromCapData<T>} FromCapData<T> */

/**
 * @param {[kind: AgoricChainStoragePathKind, item: string]} path
 */
export const pathToKey = path => path.join('.');

/** @param {string} key */
export const keyToPath = key => {
  const [kind, ...rest] = key.split('.');
  assert(kind === 'children' || kind === 'data');
  /** @type {[kind: 'children' | 'data', item: string]} */
  const out = [kind, rest.join('.')];
};

/** @param {string | unknown} d */
const parseIfJSON = d => {
  if (typeof d !== 'string') return d;
  try {
    return JSON.parse(d);
  } catch {
    return d;
  }
};

/**
 * @param {string} apiURL
 * @param {object} io
 * @param {typeof fetch} io.fetch
 */
export const makeLCD = (apiURL, { fetch }) => {
  assert.typeof(apiURL, 'string');

  /**
   * @param {string} href
   * @param {object} [options]
   * @param {Record<string, string>} [options.headers]
   */
  const getJSON = (href, options = {}) => {
    const opts = {
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };
    const url = `${apiURL}${href}`;
    return fetch(url, opts).then(r => {
      if (!r.ok) throw Error(r.statusText);
      return r.json().then(data => {
        return data;
      });
    });
  };

  return {
    getJSON,
    latestBlock: () => getJSON(`/cosmos/base/tendermint/v1beta1/blocks/latest`),
  };
};
/** @typedef {ReturnType<makeLCD>} LCD */

/**
 * @template T
 * @param {(value: string) => T} f
 * @param {AsyncGenerator<string[], void, unknown>} chunks
 */
async function* mapHistory(f, chunks) {
  for await (const chunk of chunks) {
    for (const value of chunk.reverse()) {
      yield f(value);
    }
  }
}

/**
 * @param {LCD} lcd
 */
export const makeVStorage = lcd => {
  const { getJSON } = lcd;

  // height=0 is the same as omitting height and implies the highest block
  const href = (path = 'published', { kind = 'data' } = {}) =>
    `/agoric/vstorage/${kind}/${path}`;
  const headers = height =>
    height ? { 'x-cosmos-block-height': `${height}` } : undefined;

  const readStorage = (
    path = 'published',
    { kind = 'data', height = 0 } = {},
  ) =>
    getJSON(href(path, { kind }), { headers: headers(height) }).catch(err => {
      throw Error(`cannot read ${kind} of ${path}: ${err.message}`);
    });
  const readCell = (path, opts) =>
    readStorage(path, opts)
      .then(data => data.value)
      .then(s => (s === '' ? {} : JSON.parse(s)));

  /**
   * Read values going back as far as available
   *
   * @param {string} path
   * @param {number | string} [minHeight]
   */
  async function* readHistory(path, minHeight = undefined) {
    // undefined the first iteration, to query at the highest
    let blockHeight;
    await null;
    do {
      // console.debug('READING', { blockHeight });
      /** @type {string[]} */
      let values;
      try {
        ({ blockHeight, values } = await readCell(path, {
          kind: 'data',
          height: blockHeight && Number(blockHeight) - 1,
        }));
        // console.debug('readAt returned', { blockHeight });
      } catch (err) {
        if (err.message.match(/unknown request/)) {
          // XXX FIXME
          // console.error(err);
          break;
        }
        throw err;
      }
      yield values;
      // console.debug('PUSHED', values);
      // console.debug('NEW', { blockHeight, minHeight });
      if (minHeight && Number(blockHeight) <= Number(minHeight)) break;
    } while (blockHeight > 0);
  }

  /**
   * @template T
   * @param {(value: string) => T} f
   * @param {string} path
   * @param {number | string} [minHeight]
   */
  const readHistoryBy = (f, path, minHeight) =>
    mapHistory(f, readHistory(path, minHeight));

  return {
    lcd,
    readStorage,
    readCell,
    readHistory,
    readHistoryBy,
  };
};

/** @typedef {ReturnType<typeof makeVStorage>} VStorage */

/**
 * @param {ReturnType<makeVStorage>} vstorage
 * @param {FromCapData<string>} unmarshal
 * @param {[AgoricChainStoragePathKind, string][]} paths
 */
export const batchVstorageQuery = async (vstorage, unmarshal, paths) => {
  const requests = paths.map(([kind, path]) =>
    vstorage.readStorage(path, { kind }),
  );

  return Promise.all(requests).then(responses =>
    responses.map((res, index) => {
      if (paths[index][0] === 'children') {
        return [
          pathToKey(paths[index]),
          { value: res.children, blockHeight: undefined },
        ];
      }

      if (!res.value) {
        return [
          pathToKey(paths[index]),
          {
            error: `Cannot parse value of response for path [${
              paths[index]
            }]: ${JSON.stringify(res)}`,
          },
        ];
      }

      const data = parseIfJSON(res.value);

      const latestValue =
        typeof data.values !== 'undefined'
          ? parseIfJSON(data.values[data.values.length - 1])
          : parseIfJSON(data.value);

      const unserialized =
        typeof latestValue.slots !== 'undefined'
          ? unmarshal(latestValue)
          : latestValue;

      return [
        pathToKey(paths[index]),
        {
          blockHeight: data.blockHeight,
          value: unserialized,
        },
      ];
    }),
  );
};
