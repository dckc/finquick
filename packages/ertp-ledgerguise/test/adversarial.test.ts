/**
 * @file Adversarial tests for authority boundaries.
 * @see ../src/index.ts
 */

import test from 'ava';
import Database from 'better-sqlite3';
import type { Brand, NatAmount } from '@agoric/ertp';
import { asGuid, createIssuerKit, initGnuCashSchema } from '../src/index';

const seedAccountBalance = (
  db: import('better-sqlite3').Database,
  accountGuid: string,
  commodityGuid: string,
  amount: bigint,
) => {
  db.prepare(
    [
      'INSERT INTO accounts(',
      'guid, name, account_type, commodity_guid, commodity_scu, non_std_scu, parent_guid, code, description, hidden, placeholder',
      ') VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 0, 0)',
    ].join(' '),
  ).run(accountGuid, 'Victim', 'ASSET', commodityGuid, 1, 0);
  const txGuid = asGuid('c'.repeat(32));
  db.prepare(
    [
      'INSERT INTO transactions(',
      'guid, currency_guid, num, post_date, enter_date, description',
      ') VALUES (?, ?, ?, ?, ?, ?)',
    ].join(' '),
  ).run(txGuid, commodityGuid, '', '1970-01-01 00:00:00', '1970-01-01 00:00:00', 'seed');
  db.prepare(
    [
      'INSERT INTO splits(',
      'guid, tx_guid, account_guid, memo, action, reconcile_state, reconcile_date,',
      'value_num, value_denom, quantity_num, quantity_denom, lot_guid',
      ') VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NULL)',
    ].join(' '),
  ).run(asGuid('d'.repeat(32)), txGuid, accountGuid, '', '', 'n', amount.toString(), 1, amount.toString(), 1);
};

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

  seedAccountBalance(db, victimAccountGuid, issuedKit.commodityGuid, 25n);

  t.throws(() => issuedKit.issuer.makeEmptyPurse(), { message: /account/i });
});

test('createIssuerKit rejects commodity GUID collisions', t => {
  const { freeze } = Object;
  const db = new Database(':memory:');
  t.teardown(() => db.close());
  initGnuCashSchema(db);

  const existingGuid = asGuid('f'.repeat(32));
  db.prepare(
    [
      'INSERT INTO commodities(',
      'guid, namespace, mnemonic, fullname, cusip, fraction, quote_flag, quote_source, quote_tz',
      ') VALUES (?, ?, ?, ?, NULL, ?, ?, NULL, NULL)',
    ].join(' '),
  ).run(existingGuid, 'COMMODITY', 'BUCKS', 'BUCKS', 1, 0);

  const makeGuid = () => existingGuid;
  const commodity = freeze({
    namespace: 'COMMODITY',
    mnemonic: 'BUCKS',
  });
  const nowMs = () => 0;

  t.throws(() => createIssuerKit(freeze({ db, commodity, makeGuid, nowMs })), {
    message: /commodity/i,
  });
});
