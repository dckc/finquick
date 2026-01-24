import { createHash } from 'node:crypto';

export type Guid = string & { __guidBrand: 'Guid' };
// TODO: consider a template-literal Guid type like `${hex}${hex}${string}`.

export const asGuid = (value: string): Guid => value as Guid;

export const makeDeterministicGuid = (seed: string): Guid =>
  asGuid(createHash('sha256').update(seed).digest('hex').slice(0, 32));

export const mockMakeGuid = (start: bigint = 0n): (() => Guid) => {
  let counter = start;
  return () => {
    const guid = counter;
    counter += 1n;
    return asGuid(guid.toString(16).padStart(32, '0'));
  };
};
