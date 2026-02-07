/**
 * @file ERTP-only escrow exchange tests.
 * @see ../src/escrow-ertp.ts
 */

import test, { type ExecutionContext } from 'ava';
import Database from 'better-sqlite3';
import type { IssuerKit, Payment } from '../src/ertp-types.js';
import { makeErtpEscrow } from '../src/escrow-ertp.js';
import { createIssuerKit, initGnuCashSchema } from '../src/index.js';
import { mockMakeGuid } from '../src/guids.js';
import { wrapBetterSqlite3Database } from '../src/sqlite-shim.js';
import { makeTestClock } from './mock-io.js';
import { withAmountUtils } from './ertp-tools.js';

const onlyERTP = <T extends IssuerKit<'nat'>>(kit: T): IssuerKit<'nat'> => ({
  mint: kit.mint,
  mintRecoveryPurse: kit.mintRecoveryPurse,
  issuer: kit.issuer,
  brand: kit.brand,
  displayInfo: kit.displayInfo,
});

const makeScenario = (t: ExecutionContext) => {
  const { freeze } = Object;
  const rawDb = new Database(':memory:');
  const db = wrapBetterSqlite3Database(rawDb);
  t.teardown(() => rawDb.close());
  initGnuCashSchema(db);

  const makeGuid = mockMakeGuid();
  const nowMs = makeTestClock();
  const money = withAmountUtils(
    onlyERTP(
      createIssuerKit(
        freeze({
          db,
          commodity: { namespace: 'COMMODITY', mnemonic: 'BUCKS' },
          makeGuid,
          nowMs,
        }),
      ),
    ),
  );
  const stock = withAmountUtils(
    onlyERTP(
      createIssuerKit(
        freeze({
          db,
          commodity: { namespace: 'COMMODITY', mnemonic: 'SHARES' },
          makeGuid,
          nowMs,
        }),
      ),
    ),
  );

  const purses = {
    alice: {
      money: money.issuer.makeEmptyPurse(),
      stock: stock.issuer.makeEmptyPurse(),
    },
    bob: {
      money: money.issuer.makeEmptyPurse(),
      stock: stock.issuer.makeEmptyPurse(),
    },
  };

  const escrow = makeErtpEscrow({
    issuers: {
      A: money.issuer,
      B: stock.issuer,
    },
  });

  return { money, stock, purses, escrow };
};

test('ertp escrow swaps money for stock', async t => {
  const { money, stock, purses, escrow } = makeScenario(t);
  const { $ } = money;
  const { alice, bob } = purses;
  money.fund(alice.money, 10n);
  stock.fund(bob.stock, 3n);

  const aliceOffer = {
    give: Promise.resolve(alice.money.withdraw($('$7'))),
    want: stock.amount(2n),
    payouts: {
      refund: alice.money.getDepositFacet(),
      want: alice.stock.getDepositFacet(),
    },
    cancellationP: new Promise(() => {}),
  };
  const bobOffer = {
    give: Promise.resolve(bob.stock.withdraw(stock.amount(2n))),
    want: money.amount(7n),
    payouts: {
      refund: bob.stock.getDepositFacet(),
      want: bob.money.getDepositFacet(),
    },
    cancellationP: new Promise(() => {}),
  };

  await escrow.escrowExchange(aliceOffer, bobOffer);

  t.deepEqual(
    {
      aliceMoney: alice.money.getCurrentAmount(),
      bobMoney: bob.money.getCurrentAmount(),
      aliceStock: alice.stock.getCurrentAmount(),
      bobStock: bob.stock.getCurrentAmount(),
    },
    {
      aliceMoney: money.amount(3n),
      bobMoney: money.amount(7n),
      aliceStock: stock.amount(2n),
      bobStock: stock.amount(1n),
    },
  );
});

test('escrow refunds fulfilled deposits when the other side fails', async t => {
  const { money, stock, purses, escrow } = makeScenario(t);
  const { $ } = money;
  const { alice, bob } = purses;
  money.fund(alice.money, 10n);
  stock.fund(bob.stock, 3n);

  const aliceOffer = {
    give: Promise.resolve(alice.money.withdraw($('$7'))),
    want: stock.amount(2n),
    payouts: {
      refund: alice.money.getDepositFacet(),
      want: alice.stock.getDepositFacet(),
    },
    cancellationP: new Promise(() => {}),
  };
  const bobOffer = {
    give: Promise.reject(new Error('offer failed')),
    want: money.amount(7n),
    payouts: {
      refund: bob.stock.getDepositFacet(),
      want: bob.money.getDepositFacet(),
    },
    cancellationP: new Promise(() => {}),
  };

  await t.throwsAsync(escrow.escrowExchange(aliceOffer, bobOffer), {
    message: /offer failed/,
  });

  t.deepEqual(
    {
      aliceMoney: alice.money.getCurrentAmount(),
      aliceStock: alice.stock.getCurrentAmount(),
      bobMoney: bob.money.getCurrentAmount(),
      bobStock: bob.stock.getCurrentAmount(),
    },
    {
      aliceMoney: money.amount(10n),
      aliceStock: stock.amount(0n),
      bobMoney: money.amount(0n),
      bobStock: stock.amount(3n),
    },
  );
});

test('escrow refunds deposits on cancellation', async t => {
  const { money, stock, purses, escrow } = makeScenario(t);
  const { $ } = money;
  const { alice, bob } = purses;
  money.fund(alice.money, 10n);
  stock.fund(bob.stock, 3n);

  const bobGivePaymentP = Promise.withResolvers<Payment<'nat'>>();

  const aliceOffer = {
    give: Promise.resolve(alice.money.withdraw($('$7'))),
    want: stock.amount(2n),
    payouts: {
      refund: alice.money.getDepositFacet(),
      want: alice.stock.getDepositFacet(),
    },
    cancellationP: new Promise(() => {}),
  };
  const bobOffer = {
    give: bobGivePaymentP.promise,
    want: money.amount(7n),
    payouts: {
      refund: bob.stock.getDepositFacet(),
      want: bob.money.getDepositFacet(),
    },
    cancellationP: Promise.resolve(new Error('cancelled')),
  };

  const exchangeP = escrow.escrowExchange(aliceOffer, bobOffer);

  bobGivePaymentP.resolve(bob.stock.withdraw(stock.amount(2n)));
  await t.throwsAsync(exchangeP, { message: /cancelled/ });

  t.deepEqual(
    {
      aliceMoney: alice.money.getCurrentAmount(),
      aliceStock: alice.stock.getCurrentAmount(),
      bobMoney: bob.money.getCurrentAmount(),
      bobStock: bob.stock.getCurrentAmount(),
    },
    {
      aliceMoney: money.amount(10n),
      aliceStock: stock.amount(0n),
      bobMoney: money.amount(0n),
      bobStock: stock.amount(3n),
    },
  );
});

test('escrow rejects when a party gives less than wanted', async t => {
  const { money, stock, purses, escrow } = makeScenario(t);
  const { $ } = money;
  const { alice, bob } = purses;
  money.fund(alice.money, 10n);
  stock.fund(bob.stock, 3n);

  const aliceOffer = {
    give: Promise.resolve(alice.money.withdraw($('$6'))),
    want: stock.amount(2n),
    payouts: {
      refund: alice.money.getDepositFacet(),
      want: alice.stock.getDepositFacet(),
    },
    cancellationP: new Promise(() => {}),
  };
  const bobOffer = {
    give: Promise.resolve(bob.stock.withdraw(stock.amount(2n))),
    want: money.amount(7n),
    payouts: {
      refund: bob.stock.getDepositFacet(),
      want: bob.money.getDepositFacet(),
    },
    cancellationP: new Promise(() => {}),
  };

  await t.throwsAsync(escrow.escrowExchange(aliceOffer, bobOffer), {
    message: /insufficient offer: party A/,
  });

  t.deepEqual(
    {
      aliceMoney: alice.money.getCurrentAmount(),
      aliceStock: alice.stock.getCurrentAmount(),
      bobMoney: bob.money.getCurrentAmount(),
      bobStock: bob.stock.getCurrentAmount(),
    },
    {
      aliceMoney: money.amount(10n),
      aliceStock: stock.amount(0n),
      bobMoney: money.amount(0n),
      bobStock: stock.amount(3n),
    },
  );
});
