/**
 * @file Adversarial tests for authority boundaries.
 * @see ../src/index.ts
 */

import test from 'ava';
import Database from 'better-sqlite3';
import type { Brand, NatAmount } from '../src/ertp-types.js';
import {
  asGuid,
  createIssuerKit,
  initGnuCashSchema,
  openIssuerKit,
  wrapBetterSqlite3Database,
} from '../src/index.js';
import { mockMakeGuid } from '../src/guids.js';
import type { SqlDatabase } from '../src/sql-db.js';
import { makeTestClock } from './mock-io.js';

const seedAccountBalance = (
  db: SqlDatabase,
  accountGuid: string,
  commodityGuid: string,
  amount: bigint,
) => {
  db.prepare(`
    INSERT INTO accounts(
      guid, name, account_type, commodity_guid, commodity_scu, non_std_scu,
      parent_guid, code, description, hidden, placeholder
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 0, 0)
  `).run(accountGuid, 'Victim', 'ASSET', commodityGuid, 1, 0);
  const txGuid = asGuid('c'.repeat(32));
  db.prepare(`
    INSERT INTO transactions(guid, currency_guid, num, post_date, enter_date, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(txGuid, commodityGuid, '', '1970-01-01 00:00:00', '1970-01-01 00:00:00', 'seed');
  db.prepare(`
    INSERT INTO splits(
      guid, tx_guid, account_guid, memo, action, reconcile_state, reconcile_date,
      value_num, value_denom, quantity_num, quantity_denom, lot_guid
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NULL)
  `).run(asGuid('d'.repeat(32)), txGuid, accountGuid, '', '', 'n', amount.toString(), 1, amount.toString(), 1);
};

test('rejects negative withdraw amounts', t => {
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

  t.throws(() => alicePurse.withdraw(bucks(-10n)), { message: /non-negative/ });
  t.is(alicePurse.getCurrentAmount().value, 0n);
});

test('makeEmptyPurse rejects account GUID collisions', t => {
  const { freeze } = Object;
  const rawDb = new Database(':memory:');
  const db = wrapBetterSqlite3Database(rawDb);
  t.teardown(() => rawDb.close());
  initGnuCashSchema(db);

  const commodityGuid = asGuid('a'.repeat(32));
  const victimAccountGuid = asGuid('b'.repeat(32));
  const guidSeq = [commodityGuid, victimAccountGuid];
  const makeGuid = () => {
    const guid = guidSeq.shift();
    if (!guid) throw new Error('no more guids');
    return guid;
  };
  const commodity = freeze({
    namespace: 'COMMODITY',
    mnemonic: 'BUCKS',
  });
  const nowMs = makeTestClock();
  const issuedKit = createIssuerKit(freeze({ db, commodity, makeGuid, nowMs }));

  seedAccountBalance(db, victimAccountGuid, issuedKit.commodityGuid, 25n);

  t.throws(() => issuedKit.issuer.makeEmptyPurse(), { message: /account/i });
});

test('createIssuerKit rejects commodity GUID collisions', t => {
  const { freeze } = Object;
  const rawDb = new Database(':memory:');
  const db = wrapBetterSqlite3Database(rawDb);
  t.teardown(() => rawDb.close());
  initGnuCashSchema(db);

  const existingGuid = asGuid('f'.repeat(32));
  db.prepare(`
    INSERT INTO commodities(
      guid, namespace, mnemonic, fullname, cusip, fraction, quote_flag, quote_source, quote_tz
    ) VALUES (?, ?, ?, ?, NULL, ?, ?, NULL, NULL)
  `).run(existingGuid, 'COMMODITY', 'BUCKS', 'BUCKS', 1, 0);

  const makeGuid = () => existingGuid;
  const commodity = freeze({
    namespace: 'COMMODITY',
    mnemonic: 'BUCKS',
  });
  const nowMs = makeTestClock();

  t.throws(() => createIssuerKit(freeze({ db, commodity, makeGuid, nowMs })), {
    message: /commodity/i,
  });
});

test('withdraw rejects wrong-brand amounts', t => {
  const { freeze } = Object;
  const rawDb = new Database(':memory:');
  const db = wrapBetterSqlite3Database(rawDb);
  t.teardown(() => rawDb.close());
  initGnuCashSchema(db);

  const makeGuid = mockMakeGuid();
  const nowMs = makeTestClock();
  const bucks = freeze({ namespace: 'COMMODITY', mnemonic: 'BUCKS' });
  const credits = freeze({ namespace: 'COMMODITY', mnemonic: 'CREDITS' });

  const bucksKit = createIssuerKit(freeze({ db, commodity: bucks, makeGuid, nowMs }));
  const creditsKit = createIssuerKit(freeze({ db, commodity: credits, makeGuid, nowMs }));

  const bucksBrand = bucksKit.brand as Brand<'nat'>;
  const bucksAmount = (value: bigint): NatAmount => freeze({ brand: bucksBrand, value });
  const creditsBrand = creditsKit.brand as Brand<'nat'>;
  const creditsAmount = (value: bigint): NatAmount => freeze({ brand: creditsBrand, value });

  const purse = bucksKit.issuer.makeEmptyPurse();
  const payment = bucksKit.mint.mintPayment(bucksAmount(10n));
  purse.deposit(payment);

  t.throws(() => purse.withdraw(creditsAmount(1n)), { message: /brand/i });
});

test('openAccountPurse rejects wrong-commodity accounts', t => {
  const { freeze } = Object;
  const rawDb = new Database(':memory:');
  const db = wrapBetterSqlite3Database(rawDb);
  t.teardown(() => rawDb.close());
  initGnuCashSchema(db);

  const makeGuid = mockMakeGuid();
  const nowMs = makeTestClock();
  const bucks = freeze({ namespace: 'COMMODITY', mnemonic: 'BUCKS' });
  const credits = freeze({ namespace: 'COMMODITY', mnemonic: 'CREDITS' });

  const bucksKit = createIssuerKit(freeze({ db, commodity: bucks, makeGuid, nowMs }));
  const creditsKit = createIssuerKit(freeze({ db, commodity: credits, makeGuid, nowMs }));
  const accountGuid = (() => {
    const purse = bucksKit.issuer.makeEmptyPurse();
    return bucksKit.purses.getGuid(purse);
  })();

  const creditsAccess = openIssuerKit(
    freeze({ db, commodityGuid: creditsKit.commodityGuid, makeGuid, nowMs }),
  );

  t.throws(() => creditsAccess.accounts.openAccountPurse(accountGuid), {
    message: /commodity/i,
  });
});

test('openAccountPurse rejects the holding account', t => {
  const { freeze } = Object;
  const rawDb = new Database(':memory:');
  const db = wrapBetterSqlite3Database(rawDb);
  t.teardown(() => rawDb.close());
  initGnuCashSchema(db);

  const makeGuid = mockMakeGuid();
  const nowMs = makeTestClock();
  const commodity = freeze({ namespace: 'COMMODITY', mnemonic: 'BUCKS' });
  const created = createIssuerKit(freeze({ db, commodity, makeGuid, nowMs }));
  const reopened = openIssuerKit(
    freeze({ db, commodityGuid: created.commodityGuid, makeGuid, nowMs }),
  );

  const row = db
    .prepare<[string, string], { guid: string }>(
      'SELECT guid FROM accounts WHERE name = ? AND commodity_guid = ?',
    )
    .get('BUCKS Mint Holding', created.commodityGuid);
  t.truthy(row?.guid);

  t.throws(() => reopened.accounts.openAccountPurse(asGuid(row!.guid)), {
    message: /holding/i,
  });
});
