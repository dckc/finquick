import type { Database } from 'better-sqlite3';
import type { CommoditySpec, Guid } from './types';

export const ensureCommodityRow = (
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

export const createCommodityRow = ({
  db,
  guid,
  commodity,
}: {
  db: Database;
  guid: Guid;
  commodity: CommoditySpec;
}): void => {
  const row = db
    .prepare<[string], { guid: string }>('SELECT guid FROM commodities WHERE guid = ?')
    .get(guid);
  if (row) {
    throw new Error('commodity already exists');
  }
  const {
    namespace = 'COMMODITY',
    mnemonic,
    fullname = mnemonic,
    fraction = 1,
    quoteFlag = 0,
  } = commodity;
  const insert = db.prepare(
    [
      'INSERT INTO commodities(',
      'guid, namespace, mnemonic, fullname, cusip, fraction, quote_flag, quote_source, quote_tz',
      ') VALUES (?, ?, ?, ?, NULL, ?, ?, NULL, NULL)',
    ].join(' '),
  );
  insert.run(guid, namespace, mnemonic, fullname, fraction, quoteFlag);
};

export const ensureAccountRow = ({
  db,
  accountGuid,
  name,
  commodityGuid,
  accountType = 'ASSET',
}: {
  db: Database;
  accountGuid: Guid;
  name: string;
  commodityGuid: Guid;
  accountType?: string;
}): void => {
  db.prepare(
    [
      'INSERT OR IGNORE INTO accounts(',
      'guid, name, account_type, commodity_guid, commodity_scu, non_std_scu, parent_guid, code, description, hidden, placeholder',
      ') VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 0, 0)',
    ].join(' '),
  ).run(accountGuid, name, accountType, commodityGuid, 1, 0);
};

export const createAccountRow = ({
  db,
  accountGuid,
  name,
  commodityGuid,
  accountType = 'ASSET',
}: {
  db: Database;
  accountGuid: Guid;
  name: string;
  commodityGuid: Guid;
  accountType?: string;
}): void => {
  const row = db
    .prepare<[string], { guid: string }>('SELECT guid FROM accounts WHERE guid = ?')
    .get(accountGuid);
  if (row) {
    throw new Error('account already exists');
  }
  db.prepare(
    [
      'INSERT INTO accounts(',
      'guid, name, account_type, commodity_guid, commodity_scu, non_std_scu, parent_guid, code, description, hidden, placeholder',
      ') VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 0, 0)',
    ].join(' '),
  ).run(accountGuid, name, accountType, commodityGuid, 1, 0);
};

export const requireAccountCommodity = ({
  db,
  accountGuid,
  commodityGuid,
}: {
  db: Database;
  accountGuid: Guid;
  commodityGuid: Guid;
}): void => {
  const row = db
    .prepare<[string], { commodity_guid: string }>(
      'SELECT commodity_guid FROM accounts WHERE guid = ?',
    )
    .get(accountGuid);
  if (!row) {
    throw new Error('account not found');
  }
  if (row.commodity_guid !== commodityGuid) {
    throw new Error('account commodity mismatch');
  }
};

export const getCommodityAllegedName = (db: Database, commodityGuid: Guid): string => {
  const row = db
    .prepare<[string], { fullname: string | null; mnemonic: string }>(
      'SELECT fullname, mnemonic FROM commodities WHERE guid = ?',
    )
    .get(commodityGuid);
  return row?.fullname || row?.mnemonic || 'GnuCash';
};

export const getAccountBalance = (db: Database, accountGuid: Guid): bigint => {
  const row = db
    .prepare<[string], { qty: string }>(
      'SELECT COALESCE(SUM(quantity_num), 0) AS qty FROM splits WHERE account_guid = ?',
    )
    .get(accountGuid);
  return row ? BigInt(row.qty) : 0n;
};

export const makeTransferRecorder = ({
  db,
  commodityGuid,
  balanceAccountGuid,
  makeGuid,
  nowMs,
}: {
  db: Database;
  commodityGuid: Guid;
  balanceAccountGuid: Guid;
  makeGuid: () => Guid;
  nowMs: () => number;
}) => {
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
    const now = new Date(nowMs()).toISOString().slice(0, 19);
    db.prepare(
      [
        'INSERT INTO transactions(',
        'guid, currency_guid, num, post_date, enter_date, description',
        ') VALUES (?, ?, ?, ?, ?, ?)',
      ].join(' '),
    ).run(txGuid, commodityGuid, '', now, now, `ledgerguise ${amount.toString()}`);
  };

  return (accountGuid: Guid, amount: bigint) => {
    const txGuid = makeGuid();
    recordTransaction(txGuid, amount);
    recordSplit(txGuid, accountGuid, amount);
    recordSplit(txGuid, balanceAccountGuid, -amount);
  };
};
