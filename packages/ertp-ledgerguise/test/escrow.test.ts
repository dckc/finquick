/**
 * @file Minimal escrow tests.
 * @see ../src/escrow.ts
 */

import test from 'ava';
import Database from 'better-sqlite3';
import type { Brand, NatAmount } from '../src/ertp-types';
import {
  createIssuerKit,
  initGnuCashSchema,
  makeEscrow,
  wrapBetterSqlite3Database,
} from '../src/index';
import { mockMakeGuid } from '../src/guids';
import { makeDeterministicGuid } from '../src/guids';
import { makeTestClock } from './helpers/clock';

test('escrow swaps two purses with a single holding account', t => {
  const { freeze } = Object;
  const rawDb = new Database(':memory:');
  const db = wrapBetterSqlite3Database(rawDb);
  t.teardown(() => rawDb.close());
  initGnuCashSchema(db);

  const makeGuid = mockMakeGuid();
  const nowMs = makeTestClock();
  const commodity = freeze({ namespace: 'COMMODITY', mnemonic: 'BUCKS' });
  const kit = createIssuerKit(freeze({ db, commodity, makeGuid, nowMs }));
  const brand = kit.brand as Brand<'nat'>;
  const bucks = (value: bigint): NatAmount => freeze({ brand, value });

  const holdingAccountGuid = makeDeterministicGuid(`ledgerguise-balance:${kit.commodityGuid}`);
  const escrow = makeEscrow({
    db,
    commodityGuid: kit.commodityGuid,
    holdingAccountGuid,
    getPurseGuid: kit.purses.getGuid,
    brand: kit.brand,
    makeGuid,
    nowMs,
  });

  const alice = kit.issuer.makeEmptyPurse();
  const bob = kit.issuer.makeEmptyPurse();
  alice.deposit(kit.mint.mintPayment(bucks(5n)));
  bob.deposit(kit.mint.mintPayment(bucks(4n)));

  const offer = escrow.makeOffer(
    { fromPurse: alice, toPurse: bob, amount: bucks(3n) },
    { fromPurse: bob, toPurse: alice, amount: bucks(2n) },
    'issue-123',
  );
  offer.accept();

  t.is(alice.getCurrentAmount().value, 4n);
  t.is(bob.getCurrentAmount().value, 5n);
});
