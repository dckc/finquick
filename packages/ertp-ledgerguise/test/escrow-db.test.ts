/**
 * @file Escrow tests demonstrating actor encapsulation.
 *
 * ## Actor Encapsulation (POLA)
 *
 * Multi-party tests should encapsulate each actor's state and behavior in a
 * factory function. This follows the Principle of Least Authority (POLA):
 *
 * - Actors own their purses privately; they expose only deposit facets to others
 * - Actors expose narrow interfaces (e.g., `run()`, `getBalances()`) not raw purses
 * - The test orchestrates actors without accessing their internal state
 *
 * Compare `makeClient` and `makeVendor` below: each creates private purses,
 * exposes only what counterparties need, and encapsulates the escrow protocol.
 * The test reads as a narrative: "Carl and Vince run their protocols."
 *
 * Anti-pattern (avoid in multi-party tests):
 * ```js
 * const alicePurse = issuer.makeEmptyPurse();  // leaked to test scope
 * const bobPurse = issuer.makeEmptyPurse();    // leaked to test scope
 * // test manually orchestrates withdraws/deposits
 * ```
 *
 * @see ../docs-dev/ocap-discipline.md
 */

import test from 'ava';
import Database from 'better-sqlite3';
import type { EscrowParty } from '../src/escrow-ertp.js';
import type { NatAmount, Payment } from '../src/ertp-types.js';
import {
  createIssuerKit,
  initGnuCashSchema,
  wrapBetterSqlite3Database,
} from '../src/index.js';
// TODO: move mockMakeGuid and makeTestClock to test/test-io.ts
import { mockMakeGuid } from '../src/guids.js';
import { makeTestClock } from './mock-io.js';
import { ertpOnly, withAmountUtils } from './ertp-tools.js';
import { makeErtpEscrow } from '../src/escrow-ertp.js';

const makeKit = ({
  db,
  mnemonic,
  makeGuid,
  nowMs,
}: {
  db: ReturnType<typeof wrapBetterSqlite3Database>;
  mnemonic: string;
  makeGuid: ReturnType<typeof mockMakeGuid>;
  nowMs: ReturnType<typeof makeTestClock>;
}) =>
  withAmountUtils(
    createIssuerKit(
      Object.freeze({
        db,
        commodity: { namespace: 'COMMODITY', mnemonic },
        makeGuid,
        nowMs,
      }),
    ),
  );

type VoteResolver = ReturnType<typeof Promise.withResolvers<void>>['resolve'];
type IssueIntent = {
  title: string;
  price: NatAmount;
};
type EscrowMailbox = {
  submitA: (offer: EscrowParty<'nat', 'nat'>) => Promise<void>;
  submitB: (offer: EscrowParty<'nat', 'nat'>) => Promise<void>;
  offerBP: Promise<void>;
  doneP: Promise<void>;
};

const makeVoteCounter = (
  count: number,
  stock: ReturnType<typeof withAmountUtils>,
) => {
  const votes = Array.from({ length: count }, () =>
    Promise.withResolvers<void>(),
  );
  const receiptP = Promise.all(votes.map(({ promise }) => promise)).then(() =>
    stock.mint.mintPayment(stock.amount(1n)),
  );
  return Object.assign(votes, { receiptP });
};

const makeEscrowMailbox = (
  escrow: ReturnType<typeof makeErtpEscrow<'nat', 'nat'>>,
) => {
  let offerA: EscrowParty<'nat', 'nat'> | undefined;
  let offerB: EscrowParty<'nat', 'nat'> | undefined;
  let started = false;
  const done = Promise.withResolvers<void>();
  const offerBReady = Promise.withResolvers<void>();
  const maybeStart = () => {
    if (started || !offerA || !offerB) return;
    started = true;
    void escrow
      .escrowExchange(offerA, offerB)
      .then(() => done.resolve())
      .catch(err => done.reject(err));
  };
  const submitA = async (offer: EscrowParty<'nat', 'nat'>) => {
    offerA = offer;
    maybeStart();
  };
  const submitB = async (offer: EscrowParty<'nat', 'nat'>) => {
    offerB = offer;
    offerBReady.resolve();
    maybeStart();
  };
  return {
    submitA,
    submitB,
    offerBP: offerBReady.promise,
    doneP: done.promise,
  };
};

const formatBalances = (
  balances: {
    carl: { money: NatAmount; stock: NatAmount };
    vince: { money: NatAmount; stock: NatAmount };
  },
  labels: { moneyName: string; stockName: string },
) => {
  const formatParty = (party: { money: NatAmount; stock: NatAmount }) => ({
    money: `$${party.money.value}`,
    stock: `${party.stock.value} ${labels.stockName}`,
  });
  return {
    carl: JSON.stringify(formatParty(balances.carl)),
    vince: JSON.stringify(formatParty(balances.vince)),
  };
};



type WellKnown = {
  money: ReturnType<typeof ertpOnly>;
  stock: ReturnType<typeof ertpOnly>;
  issues: ReturnType<
    typeof Promise.withResolvers<{
      escrow: ReturnType<typeof makeErtpEscrow<'nat', 'nat'>>;
      mailbox: EscrowMailbox;
      intent: IssueIntent;
    }>
  >;
};

const makeClient = ({
  money,
  stock,
  issues,
  castVote,
  log,
  give = money.$('$50'),
  want = stock.amount(1n),
  title = 'wash my windows',
}: WellKnown & {
  castVote: VoteResolver;
  log: (message: string) => void;
  give?: NatAmount;
  want?: NatAmount;
  title?: string;
}) => {
  const { freeze } = Object;
  const escrow = makeErtpEscrow({
    issuers: {
      A: money.issuer,
      B: stock.issuer,
    },
  });
  const purses = {
    money: money.issuer.makeEmptyPurse(),
    stock: stock.issuer.makeEmptyPurse(),
  };
  const moneyDeposit = purses.money.getDepositFacet();
  const stockDeposit = purses.stock.getDepositFacet();
  const makeOffer = (): EscrowParty<'nat', 'nat'> =>
    freeze({
      give: Promise.resolve(purses.money.withdraw(give)),
      want,
      payouts: freeze({
        refund: moneyDeposit,
        want: stockDeposit,
      }),
      cancellationP: new Promise(() => {}),
    });
  const mailbox = makeEscrowMailbox(escrow);
  const getBalances = () => ({
    money: purses.money.getCurrentAmount(),
    stock: purses.stock.getCurrentAmount(),
  });
  const run = () => {
    const offer = makeOffer();
    log(`posts issue "${title}" for ${give.value}n.`);
    issues.resolve({
      escrow,
      mailbox,
      intent: { title, price: give },
    });
    log('submits his offer to the escrow mailbox.');
    return mailbox
      .submitA(offer)
      .then(() => mailbox.offerBP)
      .then(() => {
        log('votes to approve after Vince submits his offer.');
        castVote();
      })
      .then(() => mailbox.doneP);
  };
  return freeze({
    moneyDeposit,
    stockDeposit,
    getBalances,
    run,
  });
};

const makeVendor = ({
  money,
  stock,
  issues,
  castVote,
  giveReceiptP,
  log,
  want = money.amount(50n),
}: WellKnown & {
  castVote: VoteResolver;
  giveReceiptP: Promise<Payment<'nat'>>;
  log: (message: string) => void;
  want?: NatAmount;
}) => {
  const { freeze } = Object;
  const purses = {
    money: money.issuer.makeEmptyPurse(),
    stock: stock.issuer.makeEmptyPurse(),
  };
  const moneyDeposit = purses.money.getDepositFacet();
  const stockDeposit = purses.stock.getDepositFacet();
  const makeOffer = (): EscrowParty<'nat', 'nat'> =>
    freeze({
      give: giveReceiptP,
      want,
      payouts: freeze({
        refund: stockDeposit,
        want: moneyDeposit,
      }),
      cancellationP: new Promise(() => {}),
    });
  const getBalances = () => ({
    money: purses.money.getCurrentAmount(),
    stock: purses.stock.getCurrentAmount(),
  });
  const run = async () => {
    log('receives the issue.');
    const { mailbox } = await issues.promise;
    log('submits his offer to the escrow mailbox.');
    await mailbox.submitB(makeOffer());
    log('votes to approve the issue.');
    castVote();
    log('waits for escrow to complete.');
    await mailbox.doneP;
  };
  return freeze({
    moneyDeposit,
    stockDeposit,
    makeOffer,
    getBalances,
    run,
  });
};

/**
 * client Carl joins the community
 * Carl posts "wash my windows" as an issue; offers $15
 * vendor Vince joins the community (un-ordered w.r.t. Carl)
 * Vince does the work; nominates himself for the payout
 * Carl agrees (endorses the nomination)
 * Vince gets paid
 */
test('escrow for services rendered (mutual consent receipt)', async t => {
  const { freeze } = Object;
  const rawDb = new Database(':memory:');
  const db = wrapBetterSqlite3Database(rawDb);
  t.teardown(() => rawDb.close());
  initGnuCashSchema(db);

  const makeGuid = mockMakeGuid();
  const nowMs = makeTestClock();
  const money = makeKit({ db, mnemonic: 'BUCKS', makeGuid, nowMs });
  const stock = makeKit({ db, mnemonic: 'SHARES', makeGuid, nowMs });
  const issues = Promise.withResolvers<{
    escrow: ReturnType<typeof makeErtpEscrow<'nat', 'nat'>>;
    mailbox: EscrowMailbox;
    intent: IssueIntent;
  }>();
  const votes = makeVoteCounter(2, stock);
  const wellKnown: WellKnown = {
    money: ertpOnly(money),
    stock: ertpOnly(stock),
    issues,
  };

  // Scope: each party runs in its own minimal-capability slice.
  // POLA: parties only get ERTP facets + escrow, not DB access or admin knobs.
  t.log(
    'Policy: community members may post issues; early resolves waste effort but do not move funds.',
  );

  t.log('Carl and Vince receive community capabilities (including voting).');
  const carl = makeClient({
    ...wellKnown,
    castVote: votes[0].resolve,
    log: msg => t.log(`Carl: ${msg}`),
  });

  // TODO: model community membership/voting as a distinct issuer + counting flow.

  const vince = makeVendor({
    ...wellKnown,
    castVote: votes[1].resolve,
    giveReceiptP: votes.receiptP,
    log: msg => t.log(`Vince: ${msg}`),
  });
  t.log('Carl has 50 bucks available for the offer.');
  money.fundDeposit(carl.moneyDeposit, 50n);
  const balancesBefore = {
    carl: carl.getBalances(),
    vince: vince.getBalances(),
  };
  const labels = {
    moneyName: money.issuer.getAllegedName(),
    stockName: stock.issuer.getAllegedName(),
  };
  t.log('Balances before escrow', formatBalances(balancesBefore, labels));
  await Promise.all([carl.run(), vince.run()]);
  const balancesAfter = {
    carl: carl.getBalances(),
    vince: vince.getBalances(),
  };
  t.log('Balances after escrow', formatBalances(balancesAfter, labels));

  t.log('Escrow completes; verify final balances.');
  t.deepEqual(
    balancesAfter,
    {
      carl: {
        money: money.amount(0n),
        stock: stock.amount(1n),
      },
      vince: {
        money: money.amount(50n),
        stock: stock.amount(0n),
      },
    },
  );
});

test('escrow swaps two purses with a single holding account', async t => {
  const { freeze } = Object;
  const rawDb = new Database(':memory:');
  const db = wrapBetterSqlite3Database(rawDb);
  t.teardown(() => rawDb.close());
  initGnuCashSchema(db);

  const makeGuid = mockMakeGuid();
  const nowMs = makeTestClock();
  const money = makeKit({ db, mnemonic: 'BUCKS', makeGuid, nowMs });
  const { $ } = money;

  const stock = makeKit({ db, mnemonic: 'SHARES', makeGuid, nowMs });

  const escrow = makeErtpEscrow({
    issuers: {
      A: money.issuer,
      B: stock.issuer,
    },
  });

  const alice = {
    money: money.issuer.makeEmptyPurse(),
    stock: stock.issuer.makeEmptyPurse(),
  };
  const bob = {
    money: money.issuer.makeEmptyPurse(),
    stock: stock.issuer.makeEmptyPurse(),
  };

  money.fund(alice.money, 5n);
  stock.fund(bob.stock, 4n);

  const aliceOffer = {
    give: Promise.resolve(alice.money.withdraw($('$3'))),
    want: stock.amount(2n),
    payouts: {
      refund: alice.money.getDepositFacet(),
      want: alice.stock.getDepositFacet(),
    },
    cancellationP: new Promise(() => {}),
  };
  const bobOffer = {
    give: Promise.resolve(bob.stock.withdraw(stock.amount(2n))),
    want: money.amount(3n),
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
      aliceMoney: money.amount(2n),
      bobMoney: money.amount(3n),
      aliceStock: stock.amount(2n),
      bobStock: stock.amount(2n),
    },
  );
});
