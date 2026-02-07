/**
 * @file Ledgerguise persistence and transfer tests.
 * @see ../src/index.ts
 */

import test from 'ava';
import Database from 'better-sqlite3';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import type { Brand, NatAmount } from '../src/ertp-types.js';
import type { Guid } from '../src/types.js';
import {
  createIssuerKit,
  initGnuCashSchema,
  openIssuerKit,
  wrapBetterSqlite3Database,
} from '../src/index.js';
import { mockMakeGuid } from '../src/guids.js';
import { makeTestClock } from './mock-io.js';

const nodeRequire = createRequire(import.meta.url);
const asset = (spec: string) => readFile(nodeRequire.resolve(spec), 'utf8');
const parseCsv = (text: string): Record<string, string>[] => {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const lines = trimmed.split(/\r?\n/);
  const headers = lines[0]?.split(',') ?? [];
  return lines.slice(1).filter(Boolean).map(line => {
    const values = line.split(',');
    return headers.reduce(
      (row, header, index) => ({ ...row, [header]: values[index] ?? '' }),
      {} as Record<string, string>,
    );
  });
};
const toRowStrings = (rows: Record<string, string>[], columns: string[]) => {
  const widths = columns.map(column =>
    Math.max(column.length, ...rows.map(row => String(row[column] ?? '').length)),
  );
  const format = (row: Record<string, string>) =>
    columns.map((column, index) => String(row[column] ?? '').padEnd(widths[index])).join(' | ');
  const header = Object.fromEntries(columns.map(column => [column, column]));
  return [format(header), ...rows.map(format)];
};

test('initGnuCashSchema creates GnuCash tables', t => {
  const rawDb = new Database(':memory:');
  const db = wrapBetterSqlite3Database(rawDb);
  t.teardown(() => rawDb.close());

  initGnuCashSchema(db);

  const row = db
    .prepare<[], { name: string }>(
      "select name from sqlite_master where type='table' and name='accounts'",
    )
    .get();
  t.is(row?.name, 'accounts');
});

test('brand.isMyIssuer rejects unrelated issuers', async t => {
  const { freeze } = Object;
  const rawDb = new Database(':memory:');
  const db = wrapBetterSqlite3Database(rawDb);
  t.teardown(() => rawDb.close());
  initGnuCashSchema(db);

  const makeGuid = mockMakeGuid();
  const commodity = freeze({
    namespace: 'COMMODITY',
    mnemonic: 'BUCKS',
  });
  const nowMs = makeTestClock();
  const kit = createIssuerKit(freeze({ db, commodity, makeGuid, nowMs }));
  const other = createIssuerKit(freeze({ db, commodity, makeGuid, nowMs }));

  t.true(await kit.brand.isMyIssuer(kit.issuer));
  t.false(await kit.brand.isMyIssuer(other.issuer));
});

test('alice sends 10 to bob', t => {
  const { freeze } = Object;
  const rawDb = new Database(':memory:');
  const db = wrapBetterSqlite3Database(rawDb);
  t.teardown(() => rawDb.close());
  initGnuCashSchema(db);

  const makeGuid = mockMakeGuid();
  const commodity = freeze({
    namespace: 'COMMODITY',
    mnemonic: 'BUCKS',
  });
  const nowMs = makeTestClock();
  const issuedKit = createIssuerKit(freeze({ db, commodity, makeGuid, nowMs }));
  const brand = issuedKit.brand as Brand<'nat'>;
  const bucks = (value: bigint): NatAmount => freeze({ brand, value });
  const alicePurse = issuedKit.issuer.makeEmptyPurse();
  const bobPurse = issuedKit.issuer.makeEmptyPurse();

  const payment = issuedKit.mint.mintPayment(bucks(10n));
  alicePurse.deposit(payment);
  bobPurse.deposit(alicePurse.withdraw(bucks(10n)));

  t.is(alicePurse.getCurrentAmount().value, 0n);
  t.is(bobPurse.getCurrentAmount().value, 10n);
});

test('deposit returns the payment amount', t => {
  const { freeze } = Object;
  const rawDb = new Database(':memory:');
  const db = wrapBetterSqlite3Database(rawDb);
  t.teardown(() => rawDb.close());
  initGnuCashSchema(db);

  const makeGuid = mockMakeGuid();
  const commodity = freeze({
    namespace: 'COMMODITY',
    mnemonic: 'BUCKS',
  });
  const nowMs = makeTestClock();
  const issuedKit = createIssuerKit(freeze({ db, commodity, makeGuid, nowMs }));
  const brand = issuedKit.brand as Brand<'nat'>;
  const bucks = (value: bigint): NatAmount => freeze({ brand, value });
  const purse = issuedKit.issuer.makeEmptyPurse();

  const firstDeposit = purse.deposit(issuedKit.mint.mintPayment(bucks(2n)));
  const secondDeposit = purse.deposit(issuedKit.mint.mintPayment(bucks(3n)));

  t.is(firstDeposit.value, 2n);
  t.is(secondDeposit.value, 3n);
});

test('fixture: withdraw-deposit matches ledger rows', async t => {
  const { freeze } = Object;
  const rawDb = new Database(':memory:');
  const db = wrapBetterSqlite3Database(rawDb);
  t.teardown(() => rawDb.close());
  initGnuCashSchema(db);

  const makeGuid = mockMakeGuid();
  const commodity = freeze({
    namespace: 'COMMODITY',
    mnemonic: 'BUCKS',
  });
  const nowMs = (() => {
    const fixed = Date.UTC(2026, 0, 24, 0, 0);
    return () => fixed;
  })();
  const issuedKit = createIssuerKit(freeze({ db, commodity, makeGuid, nowMs }));
  const brand = issuedKit.brand as Brand<'nat'>;
  const bucks = (value: bigint): NatAmount => freeze({ brand, value });
  const purse = issuedKit.issuer.makeEmptyPurse();
  const payment = issuedKit.mint.mintPayment(bucks(5000n));
  purse.deposit(payment);

  const { recoveryPurseGuid } = issuedKit.mintInfo.getMintInfo();
  const destAccountGuid = issuedKit.purses.getGuid(purse);
  const expectedTx = parseCsv(
    await asset('./fixtures/withdraw-deposit-transactions.csv'),
  )[0];
  const expectedSplits = parseCsv(
    await asset('./fixtures/withdraw-deposit-splits.csv'),
  );
  const normalize = (row: Record<string, string>) => {
    const resolved = { ...row };
    if (resolved.currency_guid === 'comm-USD') {
      resolved.currency_guid = issuedKit.commodityGuid;
    }
    if (resolved.account_guid === 'acct-source') {
      resolved.account_guid = recoveryPurseGuid;
    }
    if (resolved.account_guid === 'acct-dest') {
      resolved.account_guid = destAccountGuid;
    }
    return resolved;
  };

  const txRows = db
    .prepare<
      [],
      {
        guid: string;
        currency_guid: string;
        num: string;
        post_date: string;
        enter_date: string;
        description: string;
      }
    >('SELECT guid, currency_guid, num, post_date, enter_date, description FROM transactions')
    .all();
  t.is(txRows.length, 1);
  const actualTx = txRows[0];
  const expectedTxNormalized = normalize(expectedTx);
  t.deepEqual(
    {
      currency_guid: actualTx.currency_guid,
      num: actualTx.num,
      post_date: actualTx.post_date,
      enter_date: actualTx.enter_date,
      description: actualTx.description,
    },
    {
      currency_guid: expectedTxNormalized.currency_guid,
      num: expectedTxNormalized.num,
      post_date: expectedTxNormalized.post_date,
      enter_date: expectedTxNormalized.enter_date,
      description: expectedTxNormalized.description,
    },
  );

  const splitRows = db
    .prepare<
      [string],
      {
        account_guid: string;
        value_num: string;
        value_denom: string;
        reconcile_state: string;
      }
    >(`
      SELECT account_guid, value_num, value_denom, reconcile_state
      FROM splits
      WHERE tx_guid = ?
    `)
    .all(actualTx.guid);
  const actualSplits = splitRows
    .map(row => ({
      account_guid: row.account_guid,
      value_num: String(row.value_num),
      value_denom: String(row.value_denom),
      reconcile_state: row.reconcile_state,
    }))
    .sort((left, right) => left.account_guid.localeCompare(right.account_guid));
  const expectedSplitRows = expectedSplits
    .map(row => normalize(row))
    .map(row => ({
      account_guid: row.account_guid,
      value_num: row.value_num,
      value_denom: row.value_denom,
      reconcile_state: row.reconcile_state,
    }))
    .sort((left, right) => left.account_guid.localeCompare(right.account_guid));
  t.deepEqual(actualSplits, expectedSplitRows);
  t.snapshot(
    toRowStrings(
      [
        {
          currency_guid: actualTx.currency_guid,
          num: actualTx.num,
          post_date: actualTx.post_date,
          enter_date: actualTx.enter_date,
          description: actualTx.description,
        },
      ],
      ['currency_guid', 'num', 'post_date', 'enter_date', 'description'],
    ),
    'withdraw-deposit transactions',
  );
  t.snapshot(
    toRowStrings(actualSplits, [
      'account_guid',
      'value_num',
      'value_denom',
      'reconcile_state',
    ]),
    'withdraw-deposit splits',
  );
});

test('alice-to-bob transfer records a single transaction', t => {
  const { freeze } = Object;
  const rawDb = new Database(':memory:');
  const db = wrapBetterSqlite3Database(rawDb);
  t.teardown(() => rawDb.close());
  initGnuCashSchema(db);

  const makeGuid = mockMakeGuid();
  const commodity = freeze({
    namespace: 'COMMODITY',
    mnemonic: 'BUCKS',
  });
  const nowMs = makeTestClock();
  const issuedKit = createIssuerKit(freeze({ db, commodity, makeGuid, nowMs }));
  const brand = issuedKit.brand as Brand<'nat'>;
  const bucks = (value: bigint): NatAmount => freeze({ brand, value });
  const alicePurse = issuedKit.issuer.makeEmptyPurse();
  const bobPurse = issuedKit.issuer.makeEmptyPurse();
  const aliceGuid = issuedKit.purses.getGuid(alicePurse);
  const bobGuid = issuedKit.purses.getGuid(bobPurse);

  const payment = issuedKit.mint.mintPayment(bucks(10n));
  alicePurse.deposit(payment);
  bobPurse.deposit(alicePurse.withdraw(bucks(10n)));

  const txRows = db
    .prepare<
      [string, string],
      { tx_guid: string; alice_count: number; bob_count: number; split_count: number }
    >(`
      SELECT tx_guid,
        SUM(CASE WHEN account_guid = ? THEN 1 ELSE 0 END) AS alice_count,
        SUM(CASE WHEN account_guid = ? THEN 1 ELSE 0 END) AS bob_count,
        COUNT(*) AS split_count
      FROM splits
      GROUP BY tx_guid
      HAVING alice_count > 0 AND bob_count > 0
    `)
    .all(aliceGuid, bobGuid);
  t.is(txRows.length, 1);
  t.is(txRows[0].split_count, 2);
  const splits = db
    .prepare<[string], { reconcile_state: string }>(
      'SELECT reconcile_state FROM splits WHERE tx_guid = ?',
    )
    .all(txRows[0].tx_guid);
  t.is(splits.length, 2);
  t.true(splits.every(split => split.reconcile_state === 'c'));
});

test('payments can be reified by check number', t => {
  const { freeze } = Object;
  const rawDb = new Database(':memory:');
  const db = wrapBetterSqlite3Database(rawDb);
  t.teardown(() => rawDb.close());
  initGnuCashSchema(db);

  const makeGuid = mockMakeGuid();
  const commodity = freeze({
    namespace: 'COMMODITY',
    mnemonic: 'BUCKS',
  });
  const nowMs = makeTestClock();
  const created = createIssuerKit(freeze({ db, commodity, makeGuid, nowMs }));
  const brand = created.brand as Brand<'nat'>;
  const bucks = (value: bigint): NatAmount => freeze({ brand, value });
  const alicePurse = created.issuer.makeEmptyPurse();
  const bobPurse = created.issuer.makeEmptyPurse();
  const bobGuid = created.purses.getGuid(bobPurse);

  const payment = created.mint.mintPayment(bucks(10n));
  alicePurse.deposit(payment);
  const checkNumber = created.payments.getCheckNumber(
    alicePurse.withdraw(bucks(10n)),
  );

  const reopened = openIssuerKit(
    freeze({ db, commodityGuid: created.commodityGuid, makeGuid, nowMs: makeTestClock() }),
  );
  const reified = reopened.payments.openPayment(
    checkNumber,
  ) as ReturnType<typeof created.mint.mintPayment>;
  const reopenedBob = reopened.accounts.openAccountPurse(bobGuid);
  reopenedBob.deposit(reified);

  t.is(reopenedBob.getCurrentAmount().value, 10n);
});

test('mint payments can be reified after reopen', async t => {
  const { freeze } = Object;
  const rawDb = new Database(':memory:');
  const db = wrapBetterSqlite3Database(rawDb);
  t.teardown(() => rawDb.close());
  initGnuCashSchema(db);

  const makeGuid = mockMakeGuid();
  const commodity = freeze({
    namespace: 'COMMODITY',
    mnemonic: 'BUCKS',
  });
  const infoP = Promise.withResolvers<{ commodityGuid: Guid; checkNumber: string }>();

  {
    const nowMs = makeTestClock();
    const created = createIssuerKit(freeze({ db, commodity, makeGuid, nowMs }));
    const brand = created.brand as Brand<'nat'>;
    const bucks = (value: bigint): NatAmount => freeze({ brand, value });
    const payment = created.mint.mintPayment(bucks(10n));
    const checkNumber = created.payments.getCheckNumber(payment);
    infoP.resolve({ commodityGuid: created.commodityGuid, checkNumber });
  }

  {
    const { commodityGuid, checkNumber } = await infoP.promise;
    const reopened = openIssuerKit(
      freeze({ db, commodityGuid, makeGuid, nowMs: makeTestClock() }),
    );
    const reified = reopened.payments.openPayment(checkNumber);
    const live = await reopened.kit.issuer.isLive(reified as never);
    t.true(live);
  }
});

test('check numbers increment on collisions', t => {
  const { freeze } = Object;
  const rawDb = new Database(':memory:');
  const db = wrapBetterSqlite3Database(rawDb);
  t.teardown(() => rawDb.close());
  initGnuCashSchema(db);

  const makeGuid = mockMakeGuid();
  const nowMs = (() => {
    const fixed = Date.UTC(2020, 0, 1, 9, 15);
    return () => fixed;
  })();
  const commodity = freeze({
    namespace: 'COMMODITY',
    mnemonic: 'BUCKS',
  });
  const created = createIssuerKit(freeze({ db, commodity, makeGuid, nowMs }));
  const brand = created.brand as Brand<'nat'>;
  const bucks = (value: bigint): NatAmount => freeze({ brand, value });

  const p1 = created.mint.mintPayment(bucks(1n));
  const p2 = created.mint.mintPayment(bucks(1n));
  const n1 = created.payments.getCheckNumber(p1);
  const n2 = created.payments.getCheckNumber(p2);

  t.is(n1, '09:15');
  t.is(n2, '09:15.2');
});

test('createIssuerKit persists balances across re-open', t => {
  const { freeze } = Object;
  const rawDb = new Database(':memory:');
  const db = wrapBetterSqlite3Database(rawDb);
  t.teardown(() => rawDb.close());
  initGnuCashSchema(db);

  const makeGuid = mockMakeGuid();
  const commodity = freeze({
    namespace: 'COMMODITY',
    mnemonic: 'BUCKS',
  });

  const [aliceGuid, bobGuid, createdCommodityGuid] = (() => {
    const nowMs = makeTestClock();
    const created = createIssuerKit(freeze({ db, commodity, makeGuid, nowMs }));
    t.truthy(created.issuer);
    t.truthy(created.brand);
    t.truthy(created.mint);
    const brand = created.brand as Brand<'nat'>;
    const bucks = (value: bigint): NatAmount => freeze({ brand, value });
    const alicePurse = created.issuer.makeEmptyPurse();
    const bobPurse = created.issuer.makeEmptyPurse();

    const payment = created.mint.mintPayment(bucks(10n));
    alicePurse.deposit(payment);
    bobPurse.deposit(alicePurse.withdraw(bucks(10n)));

    t.is(alicePurse.getCurrentAmount().value, 0n);
    t.is(bobPurse.getCurrentAmount().value, 10n);
    return [
      created.purses.getGuid(alicePurse),
      created.purses.getGuid(bobPurse),
      created.commodityGuid,
    ];
  })();

  const reopened = openIssuerKit(
    freeze({ db, commodityGuid: createdCommodityGuid, makeGuid, nowMs: makeTestClock() }),
  );
  t.is(reopened.accounts.openAccountPurse(aliceGuid).getCurrentAmount().value, 0n);
  t.is(reopened.accounts.openAccountPurse(bobGuid).getCurrentAmount().value, 10n);
});
