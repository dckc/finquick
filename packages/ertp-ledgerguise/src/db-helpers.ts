import type { SqlDatabase } from './sql-db.js';
import type { CommoditySpec, Guid } from './types.js';

export const ensureCommodityRow = (
  db: SqlDatabase,
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
  const insert = db.prepare(`
    INSERT OR IGNORE INTO commodities(
      guid, namespace, mnemonic, fullname, cusip, fraction, quote_flag, quote_source, quote_tz
    ) VALUES (?, ?, ?, ?, NULL, ?, ?, NULL, NULL)
  `);
  insert.run(guid, namespace, mnemonic, fullname, fraction, quoteFlag);
};

export const createCommodityRow = ({
  db,
  guid,
  commodity,
}: {
  db: SqlDatabase;
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
  const insert = db.prepare(`
    INSERT INTO commodities(
      guid, namespace, mnemonic, fullname, cusip, fraction, quote_flag, quote_source, quote_tz
    ) VALUES (?, ?, ?, ?, NULL, ?, ?, NULL, NULL)
  `);
  insert.run(guid, namespace, mnemonic, fullname, fraction, quoteFlag);
};

export const ensureAccountRow = ({
  db,
  accountGuid,
  name,
  commodityGuid,
  accountType = 'ASSET',
  parentGuid = null,
}: {
  db: SqlDatabase;
  accountGuid: Guid;
  name: string;
  commodityGuid: Guid;
  accountType?: string;
  parentGuid?: Guid | null;
}): void => {
  db.prepare(`
    INSERT OR IGNORE INTO accounts(
      guid, name, account_type, commodity_guid, commodity_scu, non_std_scu,
      parent_guid, code, description, hidden, placeholder
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0, 0)
  `).run(accountGuid, name, accountType, commodityGuid, 1, 0, parentGuid);
};

export const createAccountRow = ({
  db,
  accountGuid,
  name,
  commodityGuid,
  accountType = 'ASSET',
  parentGuid = null,
}: {
  db: SqlDatabase;
  accountGuid: Guid;
  name: string;
  commodityGuid: Guid;
  accountType?: string;
  parentGuid?: Guid | null;
}): void => {
  const row = db
    .prepare<[string], { guid: string }>('SELECT guid FROM accounts WHERE guid = ?')
    .get(accountGuid);
  if (row) {
    throw new Error('account already exists');
  }
  db.prepare(`
    INSERT INTO accounts(
      guid, name, account_type, commodity_guid, commodity_scu, non_std_scu,
      parent_guid, code, description, hidden, placeholder
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0, 0)
  `).run(accountGuid, name, accountType, commodityGuid, 1, 0, parentGuid);
};

export const requireAccountCommodity = ({
  db,
  accountGuid,
  commodityGuid,
}: {
  db: SqlDatabase;
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

export const getCommodityAllegedName = (db: SqlDatabase, commodityGuid: Guid): string => {
  const row = db
    .prepare<[string], { fullname: string | null; mnemonic: string }>(
      'SELECT fullname, mnemonic FROM commodities WHERE guid = ?',
    )
    .get(commodityGuid);
  return row?.fullname || row?.mnemonic || 'GnuCash';
};

export const getAccountBalance = (db: SqlDatabase, accountGuid: Guid): bigint => {
  const row = db
    .prepare<[string], { qty: string }>(
      'SELECT COALESCE(SUM(quantity_num), 0) AS qty FROM splits WHERE account_guid = ?',
    )
    .get(accountGuid);
  return row ? BigInt(row.qty) : 0n;
};

/**
 * Create a recorder that writes a balanced transaction for an account transfer.
 *
 * The returned recorder creates a hold transaction (source -> holding) and can
 * later finalize it by retargeting the holding split to the destination and
 * marking the splits cleared.
 */
export const makeTransferRecorder = ({
  db,
  commodityGuid,
  holdingAccountGuid,
  makeGuid,
  nowMs,
}: {
  db: SqlDatabase;
  commodityGuid: Guid;
  holdingAccountGuid: Guid;
  makeGuid: () => Guid;
  nowMs: () => number;
}) => {
  const formatCheckNumber = (nowMsValue: number) => {
    const date = new Date(nowMsValue);
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const resolveCheckNumber = (base: string) => {
    const rows = db
      .prepare<[string, string], { num: string }>(
        'SELECT num FROM transactions WHERE num = ? OR num LIKE ?',
      )
      .all(base, `${base}.%`);
    if (rows.length === 0) return base;
    let maxSuffix = 1;
    for (const row of rows) {
      if (row.num === base) continue;
      const suffix = Number(row.num.slice(base.length + 1));
      if (Number.isInteger(suffix) && suffix > maxSuffix) {
        maxSuffix = suffix;
      }
    }
    return `${base}.${maxSuffix + 1}`;
  };

  const recordSplit = (
    txGuid: Guid,
    accountGuid: Guid,
    amount: bigint,
    reconcileState = 'n',
  ) => {
    const splitGuid = makeGuid();
    db.prepare(`
      INSERT INTO splits(
        guid, tx_guid, account_guid, memo, action, reconcile_state, reconcile_date,
        value_num, value_denom, quantity_num, quantity_denom, lot_guid
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NULL)
    `).run(
      splitGuid,
      txGuid,
      accountGuid,
      '',
      '',
      reconcileState,
      amount.toString(),
      1,
      amount.toString(),
      1,
    );
    return splitGuid;
  };

  const recordTransaction = (
    txGuid: Guid,
    amount: bigint,
    checkNumber: string,
    nowMsValue: number,
  ) => {
    const seconds = Math.floor(nowMsValue / 1000);
    db.prepare(`
      INSERT INTO transactions(guid, currency_guid, num, post_date, enter_date, description)
      VALUES (?, ?, ?, datetime(date(?, 'unixepoch')), datetime(date(?, 'unixepoch')), ?)
    `).run(
      txGuid,
      commodityGuid,
      checkNumber,
      seconds,
      seconds,
      `ledgerguise ${amount.toString()}`,
    );
  };

  const createHold = ({
    fromAccountGuid,
    amount,
  }: {
    fromAccountGuid: Guid;
    amount: bigint;
  }) => {
    const nowMsValue = nowMs();
    const txGuid = makeGuid();
    const resolvedCheckNumber = resolveCheckNumber(formatCheckNumber(nowMsValue));
    recordTransaction(txGuid, amount, resolvedCheckNumber, nowMsValue);
    const holdingSplitGuid = recordSplit(txGuid, holdingAccountGuid, amount, 'n');
    recordSplit(txGuid, fromAccountGuid, -amount, 'n');
    return { txGuid, holdingSplitGuid, checkNumber: resolvedCheckNumber };
  };

  const finalizeHold = ({
    txGuid,
    holdingSplitGuid,
    toAccountGuid,
  }: {
    txGuid: Guid;
    holdingSplitGuid: Guid;
    toAccountGuid: Guid;
  }) => {
    db.prepare(
      'UPDATE splits SET account_guid = ?, reconcile_state = ? WHERE guid = ?',
    ).run(toAccountGuid, 'c', holdingSplitGuid);
    db.prepare('UPDATE splits SET reconcile_state = ? WHERE tx_guid = ?').run('c', txGuid);
  };

  return { createHold, finalizeHold };
};
