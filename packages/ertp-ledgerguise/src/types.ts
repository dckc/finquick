import type { IssuerKit } from '@agoric/ertp';
import type { Database } from 'better-sqlite3';
import type { Guid } from './guids';

export type CommoditySpec = {
  namespace?: string;
  mnemonic: string;
  fullname?: string;
  fraction?: number;
  quoteFlag?: number;
};

export type CreateIssuerConfig = {
  db: Database;
  commodity: CommoditySpec;
  /**
   * Injected GUID generator to avoid ambient randomness and preserve ocap discipline.
   */
  makeGuid: () => Guid;
  /**
   * Injected clock returning milliseconds since epoch.
   */
  nowMs: () => number;
};

export type OpenIssuerConfig = {
  db: Database;
  commodityGuid: Guid;
  /**
   * Injected GUID generator to avoid ambient randomness and preserve ocap discipline.
   */
  makeGuid: () => Guid;
  /**
   * Injected clock returning milliseconds since epoch.
   */
  nowMs: () => number;
};

export type AmountLike = { brand: unknown; value: bigint };

export type AccountPurse = {
  deposit: (payment: object) => unknown;
  withdraw: (amount: AmountLike) => object;
  getCurrentAmount: () => AmountLike;
};

export type AccountPurseAccess = {
  makeAccountPurse: (accountGuid: Guid) => AccountPurse;
  openAccountPurse: (accountGuid: Guid) => AccountPurse;
};

export type IssuerKitForCommodity = {
  kit: IssuerKit;
  accounts: AccountPurseAccess;
  purseGuids: WeakMap<AccountPurse, Guid>;
  payments: PaymentAccess;
};

export type IssuerKitWithGuid = IssuerKit & { commodityGuid: Guid };

export type IssuerKitWithPurseGuids = IssuerKitWithGuid & {
  purses: {
    getGuid: (purse: unknown) => Guid;
  };
  payments: PaymentAccess;
};

export type PaymentAccess = {
  getCheckNumber: (payment: unknown) => string;
  openPayment: (checkNumber: string) => object;
};

export type { Guid } from './guids';
