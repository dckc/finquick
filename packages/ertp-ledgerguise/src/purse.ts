import { freezeProps, Nat } from './jessie-tools';
import {
  createAccountRow,
  ensureAccountRow,
  getAccountBalance,
  makeTransferRecorder,
  requireAccountCommodity,
} from './db-helpers';
import type { AccountPurse, AmountLike, Guid } from './types';
import type { SqlDatabase } from './sql-db';

type PurseFactoryOptions = {
  db: SqlDatabase;
  commodityGuid: Guid;
  makeAmount: (value: bigint) => AmountLike;
  makePayment: (
    amount: AmountLike,
    sourceAccountGuid: Guid,
    txGuid: Guid,
    holdingSplitGuid: Guid,
    checkNumber: string,
  ) => object;
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
  makeAmount,
  makePayment,
  paymentRecords,
  transferRecorder,
  getBrand,
}: PurseFactoryOptions) => {
  const purseGuids = new WeakMap<AccountPurse, Guid>();

  const buildPurse = (accountGuid: Guid, name: string): AccountPurse => {
    const brand = getBrand();
    const deposit = (payment: object) => {
      const record = paymentRecords.get(payment);
      if (!record?.live) throw new Error('payment not live');
      Nat(record.amount);
      record.live = false;
      transferRecorder.finalizeHold({
        txGuid: record.txGuid,
        holdingSplitGuid: record.holdingSplitGuid,
        toAccountGuid: accountGuid,
      });
      return makeAmount(getAccountBalance(db, accountGuid));
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
    const purse = freezeProps({ deposit, withdraw, getCurrentAmount });
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
