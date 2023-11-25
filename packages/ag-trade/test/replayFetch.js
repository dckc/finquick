// @ts-check

/**
 * @param {string} str
 * ack: https://stackoverflow.com/a/7616484
 */
const hashCode = str => {
  let hash = 0;
  let i;
  let chr;
  if (str.length === 0) return hash;
  for (i = 0; i < str.length; i += 1) {
    chr = str.charCodeAt(i);
    // eslint-disable-next-line no-bitwise
    hash = (hash << 5) - hash + chr;
    // eslint-disable-next-line no-bitwise
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

/**
 * Normalize JSON RPC request ID
 *
 * tendermint-rpc generates ids using ambient access to Math.random()
 * So we normalize them to a hash of the rest of the JSON.
 *
 * Earlier, we tried a sequence number, but it was non-deterministic
 * with multiple interleaved requests.
 *
 * @param {string} argsKey
 */
const normalizeID = argsKey => {
  // arbitrary string unlikely to occur in a request. from `pwgen 16 -1`
  const placeholder = 'Ajaz1chei7ohnguv';

  const noid = argsKey.replace(/\\"id\\":\d+/, `\\"id\\":${placeholder}`);
  const id = Math.abs(hashCode(noid));
  return noid.replace(placeholder, `${id}`);
};

/**
 * Wrap `fetch` to capture JSON RPC IO traffic.
 *
 * @param {typeof window.fetch} fetch
 * returns wraped fetch along with a .web map for use with {@link replayIO}
 */
export const captureIO = fetch => {
  const web = new Map();
  /** @param {Parameters<fetch>} args */
  const wrapFetch = async (...args) => {
    const key = normalizeID(JSON.stringify(args));
    const resp = await fetch(...args);
    return {
      ok: resp.ok,
      status: resp.status,
      statusText: resp.statusText,
      json: async () => {
        const data = await resp.json();
        web.set(key, data);
        return data;
      },
    };
  };
  /** @type {typeof window.fetch} */
  // @ts-expect-error mock
  const f = wrapFetch;
  return { fetch: f, web };
};

/**
 * Replay captured JSON RPC IO.
 *
 * @param {Map<string, any>} web map from
 *   JSON-stringified fetch args to fetched JSON data.
 */
export const replayIO = web => {
  /** @type {typeof window.fetch} */
  // @ts-expect-error mock
  const f = async (...args) => {
    const key = normalizeID(JSON.stringify(args));
    const data = web.get(key);
    if (!data) {
      throw Error(`no data for ${key}`);
    }
    return {
      ok: true,
      status: 200,
      statusText: 'ok',
      json: async () => data,
    };
  };
  return f;
};
