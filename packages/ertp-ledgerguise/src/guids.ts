import { createHash } from 'node:crypto';

export type Guid = string & { __guidBrand: 'Guid' };
// TODO: consider a template-literal Guid type like `${hex}${hex}${string}`.

export const asGuid = (value: string): Guid => value as Guid;

export const makeDeterministicGuid = (seed: string): Guid =>
  asGuid(createHash('sha256').update(seed).digest('hex').slice(0, 32));
