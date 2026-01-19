import type { IssuerKit } from '@agoric/ertp';
import type { SqlDatabase } from './sql-db';
import type { Guid } from './guids';
import type { Zone } from './jessie-tools';

export type CommoditySpec = {
  namespace?: string;
  mnemonic: string;
  fullname?: string;
  fraction?: number;
  quoteFlag?: number;
};

export type CreateIssuerConfig = {
  db: SqlDatabase;
  commodity: CommoditySpec;
  zone?: Zone;
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
  db: SqlDatabase;
  commodityGuid: Guid;
  zone?: Zone;
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
  mintInfo: MintInfoAccess;
};

export type IssuerKitWithGuid = IssuerKit & { commodityGuid: Guid };

export type IssuerKitWithPurseGuids = IssuerKitWithGuid & {
  purses: {
    getGuid: (purse: unknown) => Guid;
  };
  payments: PaymentAccess;
  mintInfo: MintInfoAccess;
};

export type PaymentAccess = {
  getCheckNumber: (payment: unknown) => string;
  openPayment: (checkNumber: string) => object;
};

export type MintInfoAccess = {
  getMintInfo: () => {
    holdingAccountGuid: Guid;
    recoveryPurseGuid: Guid;
  };
};

export type ChartFacet = {
  placePurse: (args: {
    purse: unknown;
    name: string;
    parentGuid?: Guid | null;
    accountType?: string;
    placeholder?: boolean;
  }) => void;
  placeAccount: (args: {
    accountGuid: Guid;
    name: string;
    parentGuid?: Guid | null;
    accountType?: string;
    placeholder?: boolean;
  }) => void;
};

export type EscrowFacet = {
  makeOffer: (
    left: { fromPurse: unknown; toPurse: unknown; amount: AmountLike },
    right: { fromPurse: unknown; toPurse: unknown; amount: AmountLike },
    checkNumber: string,
    description?: string,
  ) => {
    accept: () => void;
    cancel: () => void;
    getOfferId: () => string;
  };
};

export type { Guid } from './guids';
