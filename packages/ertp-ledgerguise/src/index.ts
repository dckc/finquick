/**
 * @file ERTP facade backed by a GnuCash sqlite database.
 *
 * Table of contents (entry points):
 * @see initGnuCashSchema
 * @see createIssuerKit
 * @see openIssuerKit
 */

import type { SqlDatabase } from './sql-db';
import { gcEmptySql } from './sql/gc_empty';
import { defaultZone, Nat } from './jessie-tools';
import type { Zone } from './jessie-tools';
import { makeDeterministicGuid } from './guids';
import type {
  AccountPurse,
  AmountLike,
  CreateIssuerConfig,
  Guid,
  NatIssuerKit,
  IssuerKitForCommodity,
  IssuerKitWithPurseGuids,
  OpenIssuerConfig,
} from './types';
import { makeChartFacet } from './chart';
import {
  createCommodityRow,
  ensureAccountRow,
  getAccountBalance,
  getCommodityAllegedName,
  makeTransferRecorder,
} from './db-helpers';
import { makePurseFactory } from './purse';
import { makeEscrow } from './escrow';

export type {
  CommoditySpec,
  EscrowFacet,
  IssuerKitForCommodity,
  IssuerKitWithGuid,
  IssuerKitWithPurseGuids,
  NatIssuerKit,
} from './types';
export { asGuid } from './guids';
export { makeChartFacet } from './chart';
export { makeEscrow } from './escrow';
export { wrapBetterSqlite3Database } from './sqlite-shim';
export type { SqlDatabase, SqlStatement } from './sql-db';
export type { Zone } from './jessie-tools';

/**
 * Initialize an empty sqlite database with the GnuCash schema.
 * @see ./sql/gc_empty.sql
 */
export const initGnuCashSchema = (
  db: SqlDatabase,
  options: { allowTransactionStatements?: boolean } = {},
): void => {
  const { allowTransactionStatements = true } = options;
  if (allowTransactionStatements) {
    db.exec(gcEmptySql);
    return;
  }
  const sanitized = gcEmptySql
    .replace(/\bBEGIN TRANSACTION;\s*/gi, '')
    .replace(/\bCOMMIT;\s*/gi, '');
  db.exec(sanitized);
};

const makeIssuerKitForCommodity = ({
  db,
  commodityGuid,
  makeGuid,
  nowMs,
  zone,
}: {
  db: SqlDatabase;
  commodityGuid: Guid;
  makeGuid: () => Guid;
  nowMs: () => number;
  zone: Zone;
}): IssuerKitForCommodity => {
  const { exo } = zone;
  const { freeze } = Object;
  // TODO: consider validation of DB capability and schema.
  const displayInfo = freeze({ assetKind: 'nat' as const });
  const amountShape = freeze({});
  const paymentRecords = new WeakMap<
    object,
    {
      amount: bigint;
      live: boolean;
      sourceAccountGuid: Guid;
      txGuid: Guid;
      holdingSplitGuid: Guid;
      checkNumber: string;
    }
  >();
  const livePayments = new Set<object>();
  const assertAmount = (amount: AmountLike) => {
    if (amount.brand !== brand) {
      throw new Error('amount brand mismatch');
    }
    return Nat(amount.value);
  };
  const makeAmount = (value: bigint) => freeze({ brand, value: Nat(value) });
  const makePayment = (
    amount: AmountLike,
    sourceAccountGuid: Guid,
    txGuid: Guid,
    holdingSplitGuid: Guid,
    checkNumber: string,
  ) => {
    const amountValue = assertAmount(amount);
    const payment = exo('Payment', {
      __getAllegedInterface__: () => {
        // TODO: return ERTP interface metadata once defined.
        throw new Error('not implemented');
      },
      [Symbol.dispose]: () => {
        const record = paymentRecords.get(payment as object);
        if (record?.live) {
          console.warn('ledgerguise payment disposed while live', {
            checkNumber: record.checkNumber,
          });
        }
      },
    });
    paymentRecords.set(payment, {
      amount: amountValue,
      live: true,
      sourceAccountGuid,
      txGuid,
      holdingSplitGuid,
      checkNumber,
    });
    livePayments.add(payment as object);
    return payment;
  };
  const getAllegedName = () => getCommodityAllegedName(db, commodityGuid);
  const commodityLabel = getAllegedName();
  const balanceAccountGuid = makeDeterministicGuid(`ledgerguise-balance:${commodityGuid}`);
  ensureAccountRow({
    db,
    accountGuid: balanceAccountGuid,
    name: `${commodityLabel} Mint Holding`,
    commodityGuid,
    // GnuCash requires non-currency commodities to live under STOCK/MUTUAL/related accounts.
    accountType: 'STOCK',
  });
  const transferRecorder = makeTransferRecorder({
    db,
    commodityGuid,
    holdingAccountGuid: balanceAccountGuid,
    makeGuid,
    nowMs,
  });
  const { ensurePurse, makeNewPurse, openPurse, purseGuids } = makePurseFactory({
    db,
    commodityGuid,
    makeAmount,
    makePayment,
    livePayments,
    paymentRecords,
    transferRecorder,
    getBrand: () => brand,
    zone,
  });
  const brand = exo('Brand', {
    isMyIssuer: async (allegedIssuer: object) => allegedIssuer === issuer,
    getAllegedName: () => getAllegedName(),
    getDisplayInfo: () => displayInfo,
    getAmountShape: () => amountShape,
  });
  const issuer = exo('Issuer', {
    getBrand: () => brand,
    getAllegedName: () => getAllegedName(),
    getAssetKind: () => 'nat' as const,
    getDisplayInfo: () => displayInfo,
    makeEmptyPurse: () => {
      const accountGuid = makeGuid();
      return makeNewPurse(accountGuid, accountGuid);
    },
    isLive: async (payment: object) => paymentRecords.get(payment)?.live ?? false,
    getAmountOf: async (payment: object) => makeAmount(paymentRecords.get(payment)?.amount ?? 0n),
    burn: async (payment: object) => {
      const record = paymentRecords.get(payment);
      if (!record?.live) throw new Error('payment not live');
      record.live = false;
      livePayments.delete(payment as object);
      transferRecorder.finalizeHold({
        txGuid: record.txGuid,
        holdingSplitGuid: record.holdingSplitGuid,
        toAccountGuid: balanceAccountGuid,
      });
      return makeAmount(record.amount);
    },
  });
  const mint = exo('Mint', {
    getIssuer: () => issuer,
    mintPayment: (amount: AmountLike) => {
      const amountValue = assertAmount(amount);
      const { txGuid, holdingSplitGuid, checkNumber } = transferRecorder.createHold({
        fromAccountGuid: balanceAccountGuid,
        amount: amountValue,
      });
      return makePayment(amount, balanceAccountGuid, txGuid, holdingSplitGuid, checkNumber);
    },
  });
  const mintRecoveryGuid = makeDeterministicGuid(`ledgerguise:recovery:${commodityGuid}`);
  ensureAccountRow({
    db,
    accountGuid: mintRecoveryGuid,
    name: `${commodityLabel} Mint Recovery`,
    commodityGuid,
    accountType: 'STOCK',
  });
  const mintRecoveryPurse = openPurse(mintRecoveryGuid, `${commodityLabel} Mint Recovery`);
  const kit = freeze({
    brand,
    issuer,
    mint,
    mintRecoveryPurse,
    displayInfo,
  }) as unknown as NatIssuerKit;
  const mintInfo = exo('MintInfoAccess', {
    getMintInfo: () => ({
      holdingAccountGuid: balanceAccountGuid,
      recoveryPurseGuid: mintRecoveryGuid,
    }),
  });
  const payments = exo('PaymentAccess', {
    getCheckNumber: (payment: unknown) => {
      const record = paymentRecords.get(payment as object);
      if (!record) throw new Error('unknown payment');
      return record.checkNumber;
    },
    openPayment: (checkNumber: string) => {
      const rows = db
        .prepare<[string], { guid: string }>('SELECT guid FROM transactions WHERE num = ?')
        .all(checkNumber);
      if (rows.length !== 1) {
        throw new Error('payment check number not unique');
      }
      const txGuid = rows[0]?.guid as Guid | undefined;
      if (!txGuid) {
        throw new Error('payment not found');
      }
      const holdingSplit = db
        .prepare<
          [string, string],
          { guid: string; account_guid: string; quantity_num: string; reconcile_state: string }
        >(
          [
            'SELECT guid, account_guid, quantity_num, reconcile_state',
            'FROM splits',
            'WHERE tx_guid = ? AND account_guid = ?',
          ].join(' '),
        )
        .get(txGuid, balanceAccountGuid);
      if (!holdingSplit) {
        throw new Error('payment not live');
      }
      if (holdingSplit.reconcile_state !== 'n') {
        throw new Error('payment not live');
      }
      const sourceSplit = db
        .prepare<
          [string, string],
          { account_guid: string }
        >(
          [
            'SELECT account_guid',
            'FROM splits',
            'WHERE tx_guid = ? AND account_guid != ?',
          ].join(' '),
        )
        .get(txGuid, balanceAccountGuid);
      if (!sourceSplit) {
        throw new Error('payment missing source split');
      }
      const amountValue = BigInt(holdingSplit.quantity_num);
      const amount = makeAmount(amountValue);
      return makePayment(
        amount,
        sourceSplit.account_guid as Guid,
        txGuid,
        holdingSplit.guid as Guid,
        checkNumber,
      );
    },
  });
  const accounts = exo('AccountAccess', {
    makeAccountPurse: (accountGuid: Guid) => {
      if (accountGuid === balanceAccountGuid) {
        throw new Error('holding account is not externally accessible');
      }
      return makeNewPurse(accountGuid, accountGuid);
    },
    openAccountPurse: (accountGuid: Guid) => {
      if (accountGuid === balanceAccountGuid) {
        throw new Error('holding account is not externally accessible');
      }
      return openPurse(accountGuid, accountGuid);
    },
  });
  return freeze({ kit, accounts, purseGuids, payments, mintInfo });
};

/**
 * Create a new GnuCash commodity entry and return an ERTP kit bound to it.
 * The returned kit includes `commodityGuid` and a `purses.getGuid()` facet.
 */
export const createIssuerKit = (config: CreateIssuerConfig): IssuerKitWithPurseGuids => {
  const { db, commodity, makeGuid, nowMs } = config;
  const zone = config.zone ?? defaultZone;
  // TODO: consider validation of DB capability and schema.
  const commodityGuid = makeGuid();
  createCommodityRow({ db, guid: commodityGuid, commodity });
  const { kit, purseGuids, payments, mintInfo } = makeIssuerKitForCommodity({
    db,
    commodityGuid,
    makeGuid,
    nowMs,
    zone,
  });
  const purses = zone.exo('PurseGuids', {
    getGuid: (purse: unknown) => {
      const guid = purseGuids.get(purse as AccountPurse);
      if (!guid) throw new Error('unknown purse');
      return guid;
    },
  });
  return Object.freeze({
    ...kit,
    commodityGuid,
    purses,
    payments,
    mintInfo,
  }) as IssuerKitWithPurseGuids;
};

/**
 * Open an existing commodity by GUID and return the kit plus account access.
 */
export const openIssuerKit = (config: OpenIssuerConfig): IssuerKitForCommodity => {
  const { db, commodityGuid, makeGuid, nowMs } = config;
  const zone = config.zone ?? defaultZone;
  // TODO: consider validation of DB capability and schema.
  // TODO: verify commodity record matches expected issuer/brand metadata.
  // TODO: add a commodity-vs-currency option (namespace, fraction defaults, and naming rules).
  return makeIssuerKitForCommodity({ db, commodityGuid, makeGuid, nowMs, zone });
};
