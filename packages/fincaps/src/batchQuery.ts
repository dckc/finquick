/* eslint-disable import/extensions */
import type { FromCapData } from '@endo/marshal';
import { AgoricChainStoragePathKind } from './types';

export const pathToKey = (path: [AgoricChainStoragePathKind, string]) =>
  path.join('.');

export const keyToPath = (key: string) => {
  const parts = key.split('.');
  return [parts[0], parts.slice(1).join('.')] as [
    AgoricChainStoragePathKind,
    string,
  ];
};

export const batchVstorageQuery = async (
  node: string,
  unmarshal: FromCapData<string>,
  paths: [AgoricChainStoragePathKind, string][],
) => {
  const urls = paths.map(
    path => new URL(`${node}/agoric/vstorage/${path[0]}/${path[1]}`).href,
  );
  const requests = urls.map(url => fetch(url));

  return Promise.all(requests)
    .then(responseDatas => Promise.all(responseDatas.map(res => res.json())))
    .then(responses =>
      responses.map((res, index) => {
        if (paths[index][0] === AgoricChainStoragePathKind.Children) {
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

        const parseIfJSON = (d: string | unknown) => {
          if (typeof d !== 'string') return d;
          try {
            return JSON.parse(d);
          } catch {
            return d;
          }
        };

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
