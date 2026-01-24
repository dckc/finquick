import { Nat } from './jessie-tools.js';
import type { Zone } from './jessie-tools.js';
import {
  createAccountRow,
  ensureAccountRow,
  getAccountBalance,
  makeTransferRecorder,
  requireAccountCommodity,
} from './db-helpers.js';
import type { AccountPurse, AmountLike, Guid } from './types.js';
import type { SqlDatabase } from './sql-db.js';

type PurseFactoryOptions = {
  db: SqlDatabase;
  commodityGuid: Guid;
  commodityLabel: string;
  makeAmount: (value: bigint) => AmountLike;
  makePayment: (
    amount: AmountLike,
    sourceAccountGuid: Guid,
    txGuid: Guid,
    holdingSplitGuid: Guid,
    checkNumber: string,
  ) => object;
  livePayments: Set<object>;
  zone: Zone;
  paymentRecords: WeakMap<
    object,
    {
      amount: bigint;
      live: boolean;
      sourceAccountGuid: Guid;
      txGuid: Guid;
      holdingSplitGuid: Guid;
      checkNumber: string;
    }
  >;
  /** @see makeTransferRecorder */
  transferRecorder: ReturnType<typeof makeTransferRecorder>;
  getBrand: () => unknown;
};
export const makePurseFactory = ({
  db,
  commodityGuid,
  commodityLabel,
  makeAmount,
  makePayment,
  livePayments,
  paymentRecords,
  transferRecorder,
  getBrand,
  zone,
}: PurseFactoryOptions) => {
  const { exo } = zone;
  const purseGuids = new WeakMap<AccountPurse, Guid>();

  const buildPurse = (accountGuid: Guid, name: string): AccountPurse => {
    const brand = getBrand();
    const deposit = (payment: object, _optAmountShape?: unknown) => {
      const record = paymentRecords.get(payment);
      if (!record?.live) throw new Error('payment not live');
      Nat(record.amount);
      record.live = false;
      livePayments.delete(payment);
      transferRecorder.finalizeHold({
        txGuid: record.txGuid,
        holdingSplitGuid: record.holdingSplitGuid,
        toAccountGuid: accountGuid,
      });
      return makeAmount(record.amount);
    };
    const withdraw = (amount: AmountLike) => {
      if (amount.brand !== brand) {
        throw new Error('amount brand mismatch');
      }
      Nat(amount.value);
      const balance = getAccountBalance(db, accountGuid);
      if (amount.value > balance) throw new Error('insufficient funds');
      const { txGuid, holdingSplitGuid, checkNumber } = transferRecorder.createHold({
        fromAccountGuid: accountGuid,
        amount: amount.value,
      });
      return makePayment(amount, accountGuid, txGuid, holdingSplitGuid, checkNumber);
    };
    const getCurrentAmount = () => makeAmount(getAccountBalance(db, accountGuid));
    const depositFacet = exo(`${commodityLabel} DepositFacet`, {
      receive: (payment: object, optAmountShape?: unknown) =>
        deposit(payment, optAmountShape),
    });
    const purse = exo(`${commodityLabel} Purse`, {
      deposit,
      withdraw,
      getCurrentAmount,
      getDepositFacet: () => depositFacet,
    });
    purseGuids.set(purse, accountGuid);
    return purse;
  };

  const ensurePurse = (accountGuid: Guid, name: string): AccountPurse => {
    ensureAccountRow({ db, accountGuid, name, commodityGuid });
    return buildPurse(accountGuid, name);
  };

  const makeNewPurse = (accountGuid: Guid, name: string): AccountPurse => {
    createAccountRow({ db, accountGuid, name, commodityGuid });
    return buildPurse(accountGuid, name);
  };

  const openPurse = (accountGuid: Guid, name: string): AccountPurse => {
    requireAccountCommodity({ db, accountGuid, commodityGuid });
    return buildPurse(accountGuid, name);
  };

  return { ensurePurse, makeNewPurse, openPurse, purseGuids };
};
