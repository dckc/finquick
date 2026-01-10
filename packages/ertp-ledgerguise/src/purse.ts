import { freezeProps } from './jessie-tools';
import {
  createAccountRow,
  ensureAccountRow,
  getAccountBalance,
  requireAccountRow,
} from './db-helpers';
import type { AccountPurse, AmountLike, Guid } from './types';

type PurseFactoryOptions = {
  db: import('better-sqlite3').Database;
  commodityGuid: Guid;
  makeAmount: (value: bigint) => AmountLike;
  makePayment: (amount: bigint) => object;
  paymentRecords: WeakMap<object, { amount: bigint; live: boolean }>;
  applyTransfer: (accountGuid: Guid, amount: bigint) => void;
  Nat: (specimen: bigint) => bigint;
};

export const makePurseFactory = ({
  db,
  commodityGuid,
  makeAmount,
  makePayment,
  paymentRecords,
  applyTransfer,
  Nat,
}: PurseFactoryOptions) => {
  const purseGuids = new WeakMap<AccountPurse, Guid>();

  const buildPurse = (accountGuid: Guid, name: string): AccountPurse => {
    const deposit = (payment: object) => {
      const record = paymentRecords.get(payment);
      if (!record?.live) throw new Error('payment not live');
      Nat(record.amount);
      record.live = false;
      applyTransfer(accountGuid, record.amount);
      return makeAmount(getAccountBalance(db, accountGuid));
    };
    const withdraw = (amount: AmountLike) => {
      Nat(amount.value);
      const balance = getAccountBalance(db, accountGuid);
      if (amount.value > balance) throw new Error('insufficient funds');
      applyTransfer(accountGuid, -amount.value);
      return makePayment(amount.value);
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
    requireAccountRow(db, accountGuid);
    return buildPurse(accountGuid, name);
  };

  return { ensurePurse, makeNewPurse, openPurse, purseGuids };
};
