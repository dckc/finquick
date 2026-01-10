/**
 * @file Ledgerguise persistence and transfer tests.
 * @see ../src/index.ts
 */

import test from 'ava';
import Database from 'better-sqlite3';
import type { Brand, NatAmount } from '@agoric/ertp';
import { asGuid, createIssuerKit, initGnuCashSchema, openIssuerKit } from '../src/index';

test('initGnuCashSchema creates GnuCash tables', t => {
  const db = new Database(':memory:');
  t.teardown(() => db.close());

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
  const db = new Database(':memory:');
  t.teardown(() => db.close());
  initGnuCashSchema(db);

  let guidCounter = 0n;
  const makeGuid = () => {
    const guid = guidCounter;
    guidCounter += 1n;
    return asGuid(guid.toString(16).padStart(32, '0'));
  };
  const commodity = freeze({
    namespace: 'COMMODITY',
    mnemonic: 'BUCKS',
  });
  const nowMs = () => 0;
  const kit = createIssuerKit(freeze({ db, commodity, makeGuid, nowMs }));
  const other = createIssuerKit(freeze({ db, commodity, makeGuid, nowMs }));

  t.true(await kit.brand.isMyIssuer(kit.issuer));
  t.false(await kit.brand.isMyIssuer(other.issuer));
});

test('alice sends 10 to bob', t => {
  const { freeze } = Object;
  const db = new Database(':memory:');
  t.teardown(() => db.close());
  initGnuCashSchema(db);

  let guidCounter = 0n;
  const makeGuid = () => {
    const guid = guidCounter;
    guidCounter += 1n;
    return asGuid(guid.toString(16).padStart(32, '0'));
  };
  const commodity = freeze({
    namespace: 'COMMODITY',
    mnemonic: 'BUCKS',
  });
  const nowMs = () => 0;
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

test('rejects negative withdraw amounts', t => {
  const { freeze } = Object;
  const db = new Database(':memory:');
  t.teardown(() => db.close());
  initGnuCashSchema(db);

  let guidCounter = 0n;
  const makeGuid = () => {
    const guid = guidCounter;
    guidCounter += 1n;
    return asGuid(guid.toString(16).padStart(32, '0'));
  };
  const commodity = freeze({
    namespace: 'COMMODITY',
    mnemonic: 'BUCKS',
  });
  const nowMs = () => 0;
  const issuedKit = createIssuerKit(freeze({ db, commodity, makeGuid, nowMs }));
  const brand = issuedKit.brand as Brand<'nat'>;
  const bucks = (value: bigint): NatAmount => freeze({ brand, value });
  const alicePurse = issuedKit.issuer.makeEmptyPurse();

  t.throws(() => alicePurse.withdraw(bucks(-10n)), { message: /non-negative/ });
  t.is(alicePurse.getCurrentAmount().value, 0n);
});

test('makeEmptyPurse rejects account GUID collisions', t => {
  const { freeze } = Object;
  const db = new Database(':memory:');
  t.teardown(() => db.close());
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
  const nowMs = () => 0;
  const issuedKit = createIssuerKit(freeze({ db, commodity, makeGuid, nowMs }));

  const seedAccountBalance = (accountGuid: string, amount: bigint) => {
    db.prepare(
      [
        'INSERT INTO accounts(',
        'guid, name, account_type, commodity_guid, commodity_scu, non_std_scu, parent_guid, code, description, hidden, placeholder',
        ') VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 0, 0)',
      ].join(' '),
    ).run(accountGuid, 'Victim', 'ASSET', issuedKit.commodityGuid, 1, 0);
    const txGuid = asGuid('c'.repeat(32));
    db.prepare(
      [
        'INSERT INTO transactions(',
        'guid, currency_guid, num, post_date, enter_date, description',
        ') VALUES (?, ?, ?, ?, ?, ?)',
      ].join(' '),
    ).run(txGuid, issuedKit.commodityGuid, '', '1970-01-01 00:00:00', '1970-01-01 00:00:00', 'seed');
    db.prepare(
      [
        'INSERT INTO splits(',
        'guid, tx_guid, account_guid, memo, action, reconcile_state, reconcile_date,',
        'value_num, value_denom, quantity_num, quantity_denom, lot_guid',
        ') VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NULL)',
      ].join(' '),
    ).run(asGuid('d'.repeat(32)), txGuid, accountGuid, '', '', 'n', amount.toString(), 1, amount.toString(), 1);
  };

  seedAccountBalance(victimAccountGuid, 25n);

  t.throws(() => issuedKit.issuer.makeEmptyPurse(), { message: /account/i });
});

test('createIssuerKit persists balances across re-open', t => {
  const { freeze } = Object;
  const db = new Database(':memory:');
  t.teardown(() => db.close());
  initGnuCashSchema(db);

  let guidCounter = 0n;
  const makeGuid = () => {
    const guid = guidCounter;
    guidCounter += 1n;
    return asGuid(guid.toString(16).padStart(32, '0'));
  };
  const commodity = freeze({
    namespace: 'COMMODITY',
    mnemonic: 'BUCKS',
  });

  const [aliceGuid, bobGuid, createdCommodityGuid] = (() => {
    const nowMs = () => 0;
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
    freeze({ db, commodityGuid: createdCommodityGuid, makeGuid, nowMs: () => 0 }),
  );
  t.is(reopened.accounts.openAccountPurse(aliceGuid).getCurrentAmount().value, 0n);
  t.is(reopened.accounts.openAccountPurse(bobGuid).getCurrentAmount().value, 10n);
});
