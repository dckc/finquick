/**
 * @file ERTP facade backed by a GnuCash sqlite database.
 *
 * Table of contents (entry points):
 * @see initGnuCashSchema
 * @see createIssuerKit
 * @see openIssuerKit
 */

import { createHash } from 'node:crypto';
import type { IssuerKit } from '@agoric/ertp';
import type { Database } from 'better-sqlite3';
import { gcEmptySql } from './sql/gc_empty';
import { freezeProps } from './jessie-tools';

export type Guid = string & { __guidBrand: 'Guid' };
// TODO: consider a template-literal Guid type like `${hex}${hex}${string}`.

export const asGuid = (value: string): Guid => value as Guid;

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
};

export type OpenIssuerConfig = {
  db: Database;
  commodityGuid: Guid;
  /**
   * Injected GUID generator to avoid ambient randomness and preserve ocap discipline.
   */
  makeGuid: () => Guid;
};

/**
 * Initialize an empty sqlite database with the GnuCash schema.
 * @see ./sql/gc_empty.sql
 */
export const initGnuCashSchema = (db: Database): void => {
  db.exec(gcEmptySql);
};

const ensureCommodityRow = (
  db: Database,
  guid: Guid,
  commodity: CommoditySpec,
): void => {
  const {
    namespace = 'COMMODITY',
    mnemonic,
    fullname = mnemonic,
    fraction = 1,
    quoteFlag = 0,
  } = commodity;
  const insert = db.prepare(
    [
      'INSERT OR IGNORE INTO commodities(',
      'guid, namespace, mnemonic, fullname, cusip, fraction, quote_flag, quote_source, quote_tz',
      ') VALUES (?, ?, ?, ?, NULL, ?, ?, NULL, NULL)',
    ].join(' '),
  );
  insert.run(guid, namespace, mnemonic, fullname, fraction, quoteFlag);
};

const makeDeterministicGuid = (seed: string): Guid =>
  asGuid(createHash('sha256').update(seed).digest('hex').slice(0, 32));

const ensureAccountRow = (
  db: Database,
  accountGuid: Guid,
  name: string,
  commodityGuid: Guid,
  accountType = 'ASSET',
): void => {
  db.prepare(
    [
      'INSERT OR IGNORE INTO accounts(',
      'guid, name, account_type, commodity_guid, commodity_scu, non_std_scu, parent_guid, code, description, hidden, placeholder',
      ') VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 0, 0)',
    ].join(' '),
  ).run(accountGuid, name, accountType, commodityGuid, 1, 0);
};

type AmountLike = { value: bigint };

type AccountPurse = {
  deposit: (payment: object) => unknown;
  withdraw: (amount: AmountLike) => object;
  getCurrentAmount: () => AmountLike;
};

type AccountPurseAccess = {
  makeAccountPurse: (accountGuid: Guid) => AccountPurse;
  openAccountPurse: (accountGuid: Guid) => AccountPurse;
};

type IssuerKitForCommodity = {
  kit: IssuerKit;
  accounts: AccountPurseAccess;
  purseGuids: WeakMap<AccountPurse, Guid>;
};

const makeIssuerKitForCommodity = (
  db: Database,
  commodityGuid: Guid,
  makeGuid: () => Guid,
): IssuerKitForCommodity => {
  const { freeze } = Object;
  // TODO: consider validation of DB capability and schema.
  const displayInfo = freeze({ assetKind: 'nat' as const });
  const amountShape = freeze({});
  const paymentRecords = new WeakMap<object, { amount: bigint; live: boolean }>();
  const makeAmount = (value: bigint) => freeze({ brand, value });
  const makePayment = (amount: bigint) => {
    const payment = freeze({});
    paymentRecords.set(payment, { amount, live: true });
    return payment;
  };
  const getAllegedName = () => {
    const row = db
      .prepare<[string], { fullname: string | null; mnemonic: string }>(
        'SELECT fullname, mnemonic FROM commodities WHERE guid = ?',
      )
      .get(commodityGuid);
    return row?.fullname || row?.mnemonic || 'GnuCash';
  };
  const balanceAccountGuid = makeDeterministicGuid(`ledgerguise-balance:${commodityGuid}`);
  ensureAccountRow(db, balanceAccountGuid, 'Ledgerguise Balance', commodityGuid, 'EQUITY');
  const getBalance = (accountGuid: Guid) => {
    const row = db
      .prepare<[string], { qty: string }>(
        'SELECT COALESCE(SUM(quantity_num), 0) AS qty FROM splits WHERE account_guid = ?',
      )
      .get(accountGuid);
    return row ? BigInt(row.qty) : 0n;
  };
  const recordSplit = (txGuid: Guid, accountGuid: Guid, amount: bigint) => {
    const splitGuid = makeGuid();
    db.prepare(
      [
        'INSERT INTO splits(',
        'guid, tx_guid, account_guid, memo, action, reconcile_state, reconcile_date,',
        'value_num, value_denom, quantity_num, quantity_denom, lot_guid',
        ') VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NULL)',
      ].join(' '),
    ).run(splitGuid, txGuid, accountGuid, '', '', 'n', amount.toString(), 1, amount.toString(), 1);
  };
  const recordTransaction = (txGuid: Guid, amount: bigint) => {
    const now = new Date().toISOString().slice(0, 19);
    db.prepare(
      [
        'INSERT INTO transactions(',
        'guid, currency_guid, num, post_date, enter_date, description',
        ') VALUES (?, ?, ?, ?, ?, ?)',
      ].join(' '),
    ).run(txGuid, commodityGuid, '', now, now, `ledgerguise ${amount.toString()}`);
  };
  const applyTransfer = (accountGuid: Guid, amount: bigint) => {
    const txGuid = makeGuid();
    recordTransaction(txGuid, amount);
    recordSplit(txGuid, accountGuid, amount);
    recordSplit(txGuid, balanceAccountGuid, -amount);
  };
  const purseGuids = new WeakMap<AccountPurse, Guid>();
  const makePurse = (accountGuid: Guid, name: string): AccountPurse => {
    ensureAccountRow(db, accountGuid, name, commodityGuid);
    const deposit = (payment: object) => {
      const record = paymentRecords.get(payment);
      if (!record?.live) throw new Error('payment not live');
      record.live = false;
      applyTransfer(accountGuid, record.amount);
      return makeAmount(getBalance(accountGuid));
    };
    const withdraw = (amount: AmountLike) => {
      const balance = getBalance(accountGuid);
      if (amount.value > balance) throw new Error('insufficient funds');
      applyTransfer(accountGuid, -amount.value);
      return makePayment(amount.value);
    };
    const getCurrentAmount = () => makeAmount(getBalance(accountGuid));
    const purse = freezeProps({ deposit, withdraw, getCurrentAmount });
    purseGuids.set(purse, accountGuid);
    return purse;
  };
  const brand = freezeProps({
    isMyIssuer: async () => false,
    getAllegedName: () => getAllegedName(),
    getDisplayInfo: () => displayInfo,
    getAmountShape: () => amountShape,
  });
  const issuer = freezeProps({
    getBrand: () => brand,
    getAllegedName: () => getAllegedName(),
    getAssetKind: () => 'nat' as const,
    getDisplayInfo: () => displayInfo,
    makeEmptyPurse: () => {
      const accountGuid = makeGuid();
      return makePurse(accountGuid, accountGuid);
    },
    isLive: async (payment: object) => paymentRecords.get(payment)?.live ?? false,
    getAmountOf: async (payment: object) => makeAmount(paymentRecords.get(payment)?.amount ?? 0n),
    burn: async (payment: object) => {
      const record = paymentRecords.get(payment);
      if (!record?.live) throw new Error('payment not live');
      record.live = false;
      return makeAmount(record.amount);
    },
  });
  const mint = freezeProps({
    getIssuer: () => issuer,
    mintPayment: (amount: { value: bigint }) => makePayment(amount.value),
  });
  const mintRecoveryPurse = makePurse(
    makeDeterministicGuid(`ledgerguise:recovery:${commodityGuid}`),
    '__mintRecovery',
  );
  const kit = freeze({
    brand,
    issuer,
    mint,
    mintRecoveryPurse,
    displayInfo,
  }) as unknown as IssuerKit;
  const accounts = freezeProps({
    makeAccountPurse: (accountGuid: Guid) => makePurse(accountGuid, accountGuid),
    openAccountPurse: (accountGuid: Guid) => makePurse(accountGuid, accountGuid),
  });
  return freezeProps({ kit, accounts, purseGuids });
};

export type IssuerKitWithGuid = IssuerKit & { commodityGuid: Guid };
export type IssuerKitWithPurseGuids = IssuerKitWithGuid & {
  purses: {
    getGuid: (purse: unknown) => Guid;
  };
};

/**
 * Create a new GnuCash commodity entry and return an ERTP kit bound to it.
 * The returned kit includes `commodityGuid` and a `purses.getGuid()` facet.
 */
export const createIssuerKit = (config: CreateIssuerConfig): IssuerKitWithPurseGuids => {
  const { db, commodity, makeGuid } = config;
  // TODO: consider validation of DB capability and schema.
  const commodityGuid = makeGuid();
  ensureCommodityRow(db, commodityGuid, commodity);
  const { kit, purseGuids } = makeIssuerKitForCommodity(db, commodityGuid, makeGuid);
  const purses = freezeProps({
    getGuid: (purse: unknown) => {
      const guid = purseGuids.get(purse as AccountPurse);
      if (!guid) throw new Error('unknown purse');
      return guid;
    },
  });
  return freezeProps({ ...kit, commodityGuid, purses }) as IssuerKitWithPurseGuids;
};

/**
 * Open an existing commodity by GUID and return the kit plus account access.
 */
export const openIssuerKit = (config: OpenIssuerConfig): IssuerKitForCommodity => {
  const { db, commodityGuid, makeGuid } = config;
  // TODO: consider validation of DB capability and schema.
  // TODO: verify commodity record matches expected issuer/brand metadata.
  // TODO: add a commodity-vs-currency option (namespace, fraction defaults, and naming rules).
  return makeIssuerKitForCommodity(db, commodityGuid, makeGuid);
};
