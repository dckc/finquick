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
 * @param {string} node
 * @param {FromCapData<string>} unmarshal
 * @param {[AgoricChainStoragePathKind, string][]} paths
 * @param {{fetch: typeof fetch}} io
 */
export const batchVstorageQuery = async (node, unmarshal, paths, { fetch }) => {
  const urls = paths.map(
    path => new URL(`${node}/agoric/vstorage/${path[0]}/${path[1]}`).href,
  );
  const requests = urls.map(url => fetch(url));

  return Promise.all(requests)
    .then(responseDatas => Promise.all(responseDatas.map(res => res.json())))
    .then(responses =>
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
