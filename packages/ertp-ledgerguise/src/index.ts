/**
 * @file ERTP facade backed by a GnuCash sqlite database.
 *
 * Table of contents (entry points):
 * @see initGnuCashSchema
 * @see createIssuerKit
 * @see openIssuerKit
 */

import type { SqlDatabase } from './sql-db.js';
import { gcEmptySql } from './sql/gc_empty.js';
import { defaultZone, Nat } from './jessie-tools.js';
import type { Zone } from './jessie-tools.js';
import { makeDeterministicGuid } from './guids.js';
import type {
  AccountPurse,
  AmountLike,
  CreateIssuerConfig,
  Guid,
  NatIssuerKit,
  IssuerKitForCommodity,
  IssuerKitWithPurseGuids,
  OpenIssuerConfig,
} from './types.js';
import { makeChartFacet } from './chart.js';
import {
  createCommodityRow,
  ensureAccountRow,
  getAccountBalance,
  getCommodityAllegedName,
  makeTransferRecorder,
} from './db-helpers.js';
import { makePurseFactory } from './purse.js';
// import { makeEscrow } from './escrow.js'; // This is the old, "all over the floor" escrow
import { makeErtpEscrow } from './escrow-ertp.js';
import { makeSealerUnsealerPair } from './sealer.js';
import type { Sealed, Sealer, Unsealer } from './sealer.js';

export type { Sealed, Sealer, Unsealer } from './sealer.js';

export type {
  CommoditySpec,
  IssuerKitForCommodity,
  IssuerKitWithGuid,
  IssuerKitWithPurseGuids,
  NatIssuerKit,
} from './types.js';
export { asGuid } from './guids.js';
export { makeChartFacet } from './chart.js';
export { makeErtpEscrow } from './escrow-ertp.js';
export { makeSettlementFacet } from './settlement.js';
export type { SettlementFacet, SettlementResult } from './settlement.js';
export { wrapBetterSqlite3Database } from './sqlite-shim.js';
export type { SqlDatabase, SqlStatement } from './sql-db.js';
export type { Zone } from './jessie-tools.js';
export type { SlotRow } from './gnucash-schema.js';
export { SLOT_TYPE_GUID, SLOT_TYPE_STRING } from './gnucash-schema.js';

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

export const ensureGnuCashSchema = (
  db: SqlDatabase,
  options: { allowTransactionStatements?: boolean } = {},
): void => {
  const row = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    )
    .get('accounts');
  if (!row) {
    initGnuCashSchema(db, options);
  }
};

const makeIssuerKitForCommodity = ({
  db,
  commodityGuid,
  makeGuid,
  nowMs,
  zone,
  unsealer, // <<< ADDED
}: {
  db: SqlDatabase;
  commodityGuid: Guid;
  makeGuid: () => Guid;
  nowMs: () => number;
  zone: Zone;
  unsealer: Unsealer; // <<< ADDED
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
    const payment = exo(`${commodityLabel} Payment`, {
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
    commodityLabel,
    makeAmount,
    makePayment,
    livePayments,
    paymentRecords,
    transferRecorder,
    getBrand: () => brand,
    zone,
  });
  const brand = exo(`${commodityLabel} Brand`, {
    isMyIssuer: async (allegedIssuer: object) => allegedIssuer === issuer,
    getAllegedName: () => getAllegedName(),
    getDisplayInfo: () => displayInfo,
    getAmountShape: () => amountShape,
  });
  const issuer = exo(`${commodityLabel} Issuer`, {
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
  const mintRecoveryGuid = makeDeterministicGuid(`ledgerguise:recovery:${commodityGuid}`);
  ensureAccountRow({
    db,
    accountGuid: mintRecoveryGuid,
    name: `${commodityLabel} Mint Recovery`,
    commodityGuid,
    accountType: 'STOCK',
  });
  const mint = exo(`${commodityLabel} Mint`, {
    getIssuer: () => issuer,
    mintPayment: (amount: AmountLike) => {
      const amountValue = assertAmount(amount);
      const { txGuid, holdingSplitGuid, checkNumber } = transferRecorder.createHold({
        fromAccountGuid: mintRecoveryGuid,
        amount: amountValue,
      });
      return makePayment(amount, mintRecoveryGuid, txGuid, holdingSplitGuid, checkNumber);
    },
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
        >(`
          SELECT guid, account_guid, quantity_num, reconcile_state
          FROM splits
          WHERE tx_guid = ? AND account_guid = ?
        `)
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
        >(`
          SELECT account_guid
          FROM splits
          WHERE tx_guid = ? AND account_guid != ?
        `)
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
 *
 * ## Facet Separation (POLA)
 *
 * The returned kit provides separate facets rather than expanding Issuer/Purse interfaces:
 *
 * - `issuer`, `brand`, `mint` - Standard ERTP interfaces (portable, no DB coupling)
 * - `purses.getGuid(purse)` - Maps purse → account GUID (requires DB knowledge)
 * - `purses.getGuidFromSealed(token)` - Unseal + map (for escrow identification)
 * - `sealer` - Create inert tokens from purses (for secure sharing)
 * - `payments` - Reify payments by check number (DB-specific recovery)
 *
 * This separation keeps ERTP interfaces clean and portable. DB-specific operations
 * live in separate facets that can be withheld from code that doesn't need them.
 * A caller with only `issuer` cannot learn account GUIDs or reify payments.
 */
export const createIssuerKit = (config: CreateIssuerConfig): IssuerKitWithPurseGuids => {
  const { db, commodity, makeGuid, nowMs } = config;
  const zone = config.zone ?? defaultZone;
  // TODO: consider validation of DB capability and schema.
  const commodityGuid = makeGuid();
  createCommodityRow({ db, guid: commodityGuid, commodity });
  const { sealer, unsealer } = makeSealerUnsealerPair();
  const { kit, purseGuids, payments, mintInfo } = makeIssuerKitForCommodity({
    db,
    commodityGuid,
    makeGuid,
    nowMs,
    zone,
    unsealer, // <<< ADDED
  });
  const purses = zone.exo('PurseGuids', {
    getGuid: (purse: unknown) => {
      const guid = purseGuids.get(purse as AccountPurse);
      if (!guid) throw new Error('unknown purse');
      return guid;
    },
    getGuidFromSealed: (sealedPurse: unknown) => {
      const purse = unsealer.unseal(sealedPurse) as AccountPurse;
      const guid = purseGuids.get(purse);
      if (!guid) throw new Error('unknown sealed purse');
      return guid;
    },
  });
  return Object.freeze({
    ...kit,
    commodityGuid,
    purses,
    payments,
    mintInfo,
    sealer, // <<< ADDED
  }) as IssuerKitWithPurseGuids;
};

/**
 * Open an existing commodity by GUID and return the kit plus account access.
 *
 * Like `createIssuerKit`, returns separate facets for POLA. Unlike `createIssuerKit`,
 * this does not return a `sealer` since opening an existing commodity does not grant
 * the authority to create new sealed tokens for its purses.
 *
 * @see createIssuerKit for facet separation rationale
 */
export const openIssuerKit = (config: OpenIssuerConfig): IssuerKitForCommodity => {
  const { db, commodityGuid, makeGuid, nowMs } = config;
  const zone = config.zone ?? defaultZone;
  // TODO: consider validation of DB capability and schema.
  // TODO: verify commodity record matches expected issuer/brand metadata.
  // TODO: add a commodity-vs-currency option (namespace, fraction defaults, and naming rules).
  const { unsealer } = makeSealerUnsealerPair();
  return makeIssuerKitForCommodity({ db, commodityGuid, makeGuid, nowMs, zone, unsealer });
};
