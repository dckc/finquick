import test from 'ava';
import type { IssuerKit } from '@agoric/ertp';
import Database from 'better-sqlite3';
import type { Brand, NatAmount } from '@agoric/ertp';
import { makeLedgerguiseKit } from '../src/index';

test('makeLedgerguiseKit returns an ERTP issuer kit backed by sqlite', t => {
  const { freeze } = Object;
  const db = new Database(':memory:');
  t.teardown(() => db.close());

  const kit = makeLedgerguiseKit(freeze({ db }));

  t.truthy(kit.issuer);
  t.truthy(kit.brand);
  t.truthy(kit.mint);

  const brand = kit.brand as Brand<'nat'>;
  const bucks = (value: bigint): NatAmount => freeze({ brand, value });
  const alicePurse = kit.issuer.makeEmptyPurse();
  const bobPurse = kit.issuer.makeEmptyPurse();

  const payment = kit.mint.mintPayment(bucks(10n));
  alicePurse.deposit(payment);

  const paymentToBob = alicePurse.withdraw(bucks(10n));
  bobPurse.deposit(paymentToBob);

  t.is(alicePurse.getCurrentAmount().value, 0n);
  t.is(bobPurse.getCurrentAmount().value, 10n);
});
