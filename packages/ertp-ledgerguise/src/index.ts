/**
 * @file ERTP facade backed by a GnuCash sqlite database.
 *
 * Table of contents (entry points):
 * @see initGnuCashSchema
 * @see createIssuerKit
 * @see openIssuerKit
 */

import type { IssuerKit } from '@agoric/ertp';
import type { Database } from 'better-sqlite3';
import { gcEmptySql } from './sql/gc_empty';
import { freezeProps } from './jessie-tools';
import { makeDeterministicGuid } from './guids';
import type {
  AccountPurse,
  CreateIssuerConfig,
  Guid,
  IssuerKitForCommodity,
  IssuerKitWithPurseGuids,
  OpenIssuerConfig,
} from './types';
import {
  ensureAccountRow,
  ensureCommodityRow,
  getCommodityAllegedName,
  makeTransferRecorder,
} from './db-helpers';
import { makePurseFactory } from './purse';

export type {
  CommoditySpec,
  IssuerKitForCommodity,
  IssuerKitWithGuid,
  IssuerKitWithPurseGuids,
} from './types';
export { asGuid } from './guids';

/**
 * Initialize an empty sqlite database with the GnuCash schema.
 * @see ./sql/gc_empty.sql
 */
export const initGnuCashSchema = (db: Database): void => {
  db.exec(gcEmptySql);
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
  const getAllegedName = () => getCommodityAllegedName(db, commodityGuid);
  const balanceAccountGuid = makeDeterministicGuid(`ledgerguise-balance:${commodityGuid}`);
  ensureAccountRow(db, balanceAccountGuid, 'Ledgerguise Balance', commodityGuid, 'EQUITY');
  const applyTransfer = makeTransferRecorder(
    db,
    commodityGuid,
    balanceAccountGuid,
    makeGuid,
  );
  const { makePurse, purseGuids } = makePurseFactory({
    db,
    commodityGuid,
    makeAmount,
    makePayment,
    paymentRecords,
    applyTransfer,
  });
  const brand = freezeProps({
    isMyIssuer: async (allegedIssuer: object) => allegedIssuer === issuer,
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
