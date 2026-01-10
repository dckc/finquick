import type { IssuerKit } from '@agoric/ertp';
import type { Database } from 'better-sqlite3';

export type LedgerguiseConfig = {
  db: Database;
};

export const makeLedgerguiseKit = (_config: LedgerguiseConfig): IssuerKit => {
  throw new Error('Not implemented');
};
