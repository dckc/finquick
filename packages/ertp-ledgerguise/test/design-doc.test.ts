/**
 * @file Snapshot-based design doc for ERTP->GnuCash mapping.
 */

import type { TestFn } from 'ava';
import test from 'ava';
import type { Brand, DepositFacet, Issuer, NatAmount, Payment } from '../src/ertp-types.js';
import { makeErtpEscrow, type EscrowParty } from '../src/escrow-ertp.js';
import {
  createIssuerKit,
  makeChartFacet,
  makeSettlementFacet,
  type Sealer,
  wrapBetterSqlite3Database,
} from '../src/index.js';
import type { Guid } from '../src/types.js';
import { makeTestClock, makeTestDb, mockMakeGuid } from './mock-io.js';
import {
  type AccountView,
  type AccountWithCode,
  type SplitEntry,
  accountViewCols,
  shortDates,
  shortGuid,
  shortGuids,
  splitEntryCols,
  toRowStrings,
} from './gnucash-tools.js';
import type {
  AccountRow,
  BooksRow,
  SplitRow,
  TransactionRow,
} from '../src/gnucash-schema.js';

type AccountPath = Pick<AccountRow, 'guid' | 'name' | 'parent_guid'>;

// #endregion

const makeDesignContext = () => {
  const { freeze } = Object;
  const { db, close } = makeTestDb();

  const makeGuid = mockMakeGuid();
  const nowMs = makeTestClock(Date.UTC(2026, 0, 24, 0, 0), 1);
  const commodity = freeze({ namespace: 'COMMODITY', mnemonic: 'BUCKS' });
  const kit = createIssuerKit(freeze({ db, commodity, makeGuid, nowMs }));
  const purse = kit.issuer.makeEmptyPurse();

  return { db, kit, purse, close };
};

const serial = test.serial as TestFn<ReturnType<typeof makeDesignContext>>;

serial.before(t => (t.context = makeDesignContext()));
serial.after(t => t.context.close());

serial('Mint and deposit', t => {
  const { freeze } = Object;
  const { db, kit, purse } = t.context;
  const brand = kit.brand as Brand<'nat'>;
  const bucks = (value: bigint): NatAmount => freeze({ brand, value });

  purse.deposit(kit.mint.mintPayment(bucks(5n)));

  const txRows = db
    .prepare<[], Omit<TransactionRow, 'currency_guid' | 'description'>>(
      `SELECT guid, num, post_date, enter_date FROM transactions ORDER BY guid`,
    )
    .all()
    .map(shortGuids())
    .map(shortDates());
  const splitRows = db
    .prepare<[], SplitEntry>(
      `SELECT guid, tx_guid, account_guid, value_num, value_denom, reconcile_state
       FROM splits ORDER BY guid`,
    )
    .all()
    .map(shortGuids());

  t.snapshot(
    toRowStrings(txRows, ['guid', 'num', 'post_date', 'enter_date']),
    `GnuCash is an accounting program; a bit like Quicken but based more on traditional double-entry accounting.
ERTP is a flexible Electronic Rights protocol.
ERTP is flexible enough that we can implement it on top of a GnuCash database.

Let's mint 5 BUCKS and deposit them into a purse, then see how that's reflected in the GnuCash DB.
This creates one transaction and two splits, moving value from the mint recovery account into the purse.`,
  );
  t.snapshot(
    toRowStrings(splitRows, splitEntryCols),
    `Splits show the value move: one positive into the purse account and one negative out of the mint recovery account.

Context: before the deposit we already created issuer and purse records:
  const { issuer } = makeIssuerKit("BUCKS");
  const purse = issuer.makeEmptyPurse();

Those actions touch other tables too:
- createIssuerKit inserts a commodity row (BUCKS) and creates mint recovery/holding accounts.
- makeEmptyPurse inserts an account row for the new purse.`,
  );
});

serial('ERTP is separate from naming', t => {
  const { db, kit } = t.context;
  const accounts = db
    .prepare<[string], AccountView>(
      `
      SELECT guid, name, parent_guid, account_type, placeholder
      FROM accounts WHERE commodity_guid = ? ORDER BY guid
    `,
    )
    .all(kit.commodityGuid);
  const accountsView = accounts
    .filter(row => row.name === row.guid)
    .map(shortGuids())
    .map(row => ({ ...row, placeholder: row.placeholder ? '1' : '0' }));
  t.snapshot(
    toRowStrings(accountsView, accountViewCols),
    `ERTP mints are separate from human-facing names.
Anyone can create an ERTP \`Mint\`; if someone called it USD when it was not, that would be trouble.
Until we give accounts names, the ledger is correct but opaque to humans.`,
  );
});

serial('Giving names in the chart of accounts', t => {
  const { db, kit, purse } = t.context;
  const root = db
    .prepare<[], BooksRow>('SELECT root_account_guid FROM books LIMIT 1')
    .get();

  // Name the purse "Alice" in the chart of accounts
  const chart = makeChartFacet({
    db,
    commodityGuid: kit.commodityGuid,
    getGuidFromSealed: kit.purses.getGuidFromSealed,
  });
  chart.placePurse({
    sealedPurse: kit.sealer.seal(purse),
    name: 'Alice',
    parentGuid: root?.root_account_guid as Guid,
    accountType: 'STOCK',
  });

  const accountsViewNamed = db
    .prepare<[string], AccountView>(
      `
      SELECT guid, name, parent_guid, account_type, placeholder
      FROM accounts WHERE commodity_guid = ? ORDER BY guid
    `,
    )
    .all(kit.commodityGuid)
    .map(shortGuids())
    .map(row => ({ ...row, placeholder: row.placeholder ? '1' : '0' }));
  t.snapshot(
    toRowStrings(accountsViewNamed, accountViewCols),
    `The actual setup passes { db, ... } to connect to a GnuCash database.
Using other columns in that same database, we can give accounts human-readable names:
  const chart = makeChartFacet({ db, ... });
  chart.placePurse({ sealedPurse: kit.sealer.seal(purse), name: "Alice", ... });

Placing the purse under a parent account gives it a name and a path (e.g., Org1:Alice).
The sealed token identifies the purse without leaking withdrawal authority.`,
  );
});

serial('Building account hierarchies with placeholder parents', t => {
  const { freeze } = Object;
  const { db, close } = makeTestDb();
  t.teardown(close);

  const makeGuid = mockMakeGuid();
  const now = makeTestClock(Date.UTC(2026, 0, 25, 0, 0), 1);

  const commodity = freeze({ namespace: 'COMMODITY', mnemonic: 'USD' });
  const moolaKit = createIssuerKit(
    freeze({ db, commodity, makeGuid, nowMs: now }),
  );

  const chart = makeChartFacet({
    db,
    commodityGuid: moolaKit.commodityGuid,
    getGuidFromSealed: moolaKit.purses.getGuidFromSealed,
  });
  const { sealer } = moolaKit;

  const root = db
    .prepare<[], BooksRow>('SELECT root_account_guid FROM books LIMIT 1')
    .get();
  const rootGuid = root?.root_account_guid as Guid;

  // Build a traditional chart of accounts hierarchy with account codes
  const assets = moolaKit.issuer.makeEmptyPurse();
  const bank = moolaKit.issuer.makeEmptyPurse();
  const checking = moolaKit.issuer.makeEmptyPurse();
  const savings = moolaKit.issuer.makeEmptyPurse();
  const expenses = moolaKit.issuer.makeEmptyPurse();
  const food = moolaKit.issuer.makeEmptyPurse();

  chart.placePurse({
    sealedPurse: sealer.seal(assets),
    name: 'Assets',
    parentGuid: rootGuid,
    accountType: 'ASSET',
    placeholder: true,
    code: '1000',
  });
  const assetsGuid = moolaKit.purses.getGuid(assets);

  chart.placePurse({
    sealedPurse: sealer.seal(bank),
    name: 'Bank',
    parentGuid: assetsGuid,
    accountType: 'BANK',
    placeholder: true,
    code: '1100',
  });
  const bankGuid = moolaKit.purses.getGuid(bank);

  chart.placePurse({
    sealedPurse: sealer.seal(checking),
    name: 'Checking',
    parentGuid: bankGuid,
    accountType: 'BANK',
    code: '1110',
  });
  chart.placePurse({
    sealedPurse: sealer.seal(savings),
    name: 'Savings',
    parentGuid: bankGuid,
    accountType: 'BANK',
    code: '1120',
  });

  chart.placePurse({
    sealedPurse: sealer.seal(expenses),
    name: 'Expenses',
    parentGuid: rootGuid,
    accountType: 'EXPENSE',
    placeholder: true,
    code: '6000',
  });
  const expensesGuid = moolaKit.purses.getGuid(expenses);

  chart.placePurse({
    sealedPurse: sealer.seal(food),
    name: 'Food',
    parentGuid: expensesGuid,
    accountType: 'EXPENSE',
    code: '6100',
  });

  // Query showing how guid/parent_guid form the tree, with codes for cross-system integration
  const accounts = db
    .prepare<[string], AccountWithCode>(
      `
      SELECT guid, name, parent_guid, placeholder, code
      FROM accounts WHERE commodity_guid = ? ORDER BY code, name
    `,
    )
    .all(moolaKit.commodityGuid)
    .filter(row => !row.name.includes('Mint')) // exclude internal accounts
    .map(shortGuids())
    .map(row => ({ ...row, placeholder: row.placeholder ? '1' : '0' }));

  t.snapshot(
    toRowStrings(accounts, ['guid', 'code', 'name', 'parent_guid', 'placeholder']),
    `The accounts table forms a tree via guid and parent_guid columns.
Account codes (1000, 1100, etc.) enable cross-system integration.
Placeholder accounts (1) group children; leaf accounts (0) hold balances.

Tree structure:
  1000 Assets (placeholder)
    1100 Bank (placeholder)
      1110 Checking
      1120 Savings
  6000 Expenses (placeholder)
    6100 Food`,
  );
});

serial('Withdraw creates a hold', t => {
  const { freeze } = Object;
  const { db, kit, purse } = t.context;
  const brand = kit.brand as Brand<'nat'>;
  const bucks = (value: bigint): NatAmount => freeze({ brand, value });

  purse.withdraw(bucks(2n));

  const txRows = db
    .prepare<[], Omit<TransactionRow, 'description'>>(
      `
      SELECT guid, currency_guid, num, post_date, enter_date
      FROM transactions
      ORDER BY guid
    `,
    )
    .all()
    .map(shortGuids())
    .map(shortDates());
  const holdSplits = db
    .prepare<[], SplitEntry & { account_name: string }>(
      `
      SELECT splits.guid, splits.tx_guid, splits.account_guid, accounts.name AS account_name,
        splits.value_num, splits.value_denom, splits.reconcile_state
      FROM splits JOIN accounts ON splits.account_guid = accounts.guid
      WHERE splits.reconcile_state = 'n'
      ORDER BY splits.guid
    `,
    )
    .all()
    .map(shortGuids());
  t.snapshot(
    toRowStrings(txRows, ['guid', 'num', 'post_date', 'enter_date']),
    `Withdraw removes value from the purse by creating a new hold transaction, in addition to the earlier mint/deposit transaction.
The hold keeps value in a dedicated holding account until deposit or cancel.`,
  );
  t.snapshot(
    toRowStrings(holdSplits, ['guid', 'tx_guid', 'account_guid', 'account_name', 'value_num', 'value_denom', 'reconcile_state']),
    `Hold splits (reconcile_state='n') show value leaving the purse and landing in the holding account.`,
  );
});

/**
 * Helper to snapshot splits, tracking which ones are new since last call.
 * Shows full account paths (e.g., Alice:Moola) instead of just names.
 */
const makeSplitTracker = (db: ReturnType<typeof wrapBetterSqlite3Database>) => {
  const seenGuids = new Set<string>();

  // Build a map of guid -> full path for all accounts
  const buildPathMap = () => {
    const accounts = db
      .prepare<[], Pick<AccountRow, 'guid' | 'name' | 'parent_guid'>>(
        'SELECT guid, name, parent_guid FROM accounts',
      )
      .all();
    const guidToAccount = new Map(accounts.map(a => [a.guid, a]));

    const getPath = (guid: string): string => {
      const acc = guidToAccount.get(guid);
      if (!acc) return '?';
      if (!acc.parent_guid) return acc.name;
      const parent = guidToAccount.get(acc.parent_guid);
      if (!parent || parent.name === 'Root Account') return acc.name;
      return `${getPath(acc.parent_guid)}:${acc.name}`;
    };

    return new Map(accounts.map(a => [a.guid, getPath(a.guid)]));
  };

  type SplitWithPath = Omit<SplitEntry, 'guid'> & { split_guid: string };
  const getAllSplits = () => {
    const pathMap = buildPathMap();
    return db
      .prepare<[], SplitWithPath>(
        `
        SELECT s.guid as split_guid, s.tx_guid, s.account_guid,
               s.value_num, s.value_denom, s.reconcile_state
        FROM splits s ORDER BY s.tx_guid, s.account_guid
      `,
      )
      .all()
      .map(row => ({
        ...row,
        account_path: pathMap.get(row.account_guid) ?? row.account_guid,
      }));
  };

  return {
    /** Get only splits added since the last call to getNewSplits */
    getNewSplits: () => {
      const allSplits = getAllSplits();
      const newSplits = allSplits.filter(row => !seenGuids.has(row.split_guid));
      for (const row of allSplits) {
        seenGuids.add(row.split_guid);
      }
      return newSplits.map(shortGuids(['tx_guid'])).map(row => ({
        tx_guid: row.tx_guid,
        account: row.account_path,
        value_num: row.value_num,
        value_denom: row.value_denom,
        reconcile_state: row.reconcile_state,
      }));
    },
  };
};

const splitColumns = [
  'tx_guid',
  'account',
  'value_num',
  'value_denom',
  'reconcile_state',
];

/**
 * Tap a promise to signal when it resolves (for test observability).
 */
const withCoordination = <T>(paymentP: Promise<T>) => {
  const { freeze } = Object;
  const deposited = Promise.withResolvers<void>();
  const observed = paymentP.then(p => {
    deposited.resolve();
    return p;
  });
  return freeze({ promise: observed, deposited: deposited.promise });
};

/**
 * Factory for a party (Alice or Bob) with encapsulated purses.
 * Party can create EscrowParty offers for escrow-ertp.
 */
const makeParty = (
  moolaIssuer: Issuer<'nat'>,
  stockIssuer: Issuer<'nat'>,
  moolaSealer: Sealer,
  stockSealer: Sealer,
) => {
  const { freeze } = Object;
  // Closely held by the party
  const moola = moolaIssuer.makeEmptyPurse();
  const stock = stockIssuer.makeEmptyPurse();

  const moolaBrand = moola.getCurrentAmount().brand;

  return freeze({
    getSealedMoola: () => moolaSealer.seal(moola),
    getSealedStock: () => stockSealer.seal(stock),
    getMoolaDeposit: () => moola.getDepositFacet(),
    getStockDeposit: () => stock.getDepositFacet(),
    getBalances: () =>
      freeze({ moola: moola.getCurrentAmount(), stock: stock.getCurrentAmount() }),

    /**
     * Build an EscrowParty for escrow-ertp.
     * Returns { party, run, deposited } - call run() when party decides to fund.
     */
    offer: (
      giveAmt: NatAmount,
      wantAmt: NatAmount,
      wantDeposit: DepositFacet<'nat'>,
    ) => {
      const payment = Promise.withResolvers<Payment<'nat'>>();
      const coord = withCoordination(payment.promise);
      const givePurse = giveAmt.brand === moolaBrand ? moola : stock;
      const refundDeposit =
        giveAmt.brand === moolaBrand
          ? moola.getDepositFacet()
          : stock.getDepositFacet();

      return freeze({
        party: freeze({
          give: coord.promise,
          want: wantAmt,
          payouts: freeze({ refund: refundDeposit, want: wantDeposit }),
          cancellationP: new Promise(() => {}),
        }) as EscrowParty<'nat', 'nat'>,
        run: async () => {
          payment.resolve(givePurse.withdraw(giveAmt));
        },
        deposited: coord.deposited,
      });
    },
  });
};

serial('Escrow exchange (AMIX-style state machine)', async t => {
  const { freeze } = Object;
  const { db, close } = makeTestDb();
  t.teardown(close);

  const makeGuid = mockMakeGuid();
  const now = makeTestClock(Date.UTC(2026, 0, 25, 0, 0), 1);

  const makeKit = (mnemonic: string, namespace: 'CURRENCY' | 'COMMODITY') =>
    createIssuerKit(
      freeze({
        db,
        commodity: freeze({ namespace, mnemonic }),
        makeGuid,
        nowMs: now,
      }),
    );

  // Moola is CURRENCY (can be transaction valuation currency)
  // Stock is COMMODITY (valued in terms of a currency)
  const moola = makeKit('Moola', 'CURRENCY');
  const stock = makeKit('Stock', 'COMMODITY');

  const moolaAmt = (v: bigint) => freeze({ brand: moola.brand, value: v });
  const stockAmt = (v: bigint) => freeze({ brand: stock.brand, value: v });

  // Chart facets for naming accounts
  const charts = {
    moola: makeChartFacet({
      db,
      commodityGuid: moola.commodityGuid,
      getGuidFromSealed: moola.purses.getGuidFromSealed,
    }),
    stock: makeChartFacet({
      db,
      commodityGuid: stock.commodityGuid,
      getGuidFromSealed: stock.purses.getGuidFromSealed,
    }),
  };
  const root = db
    .prepare<[], BooksRow>('SELECT root_account_guid FROM books LIMIT 1')
    .get();
  const rootGuid = root?.root_account_guid as Guid;

  // Create placeholder parent accounts for hierarchy
  const placeholders = {
    alice: moola.issuer.makeEmptyPurse(),
    bob: moola.issuer.makeEmptyPurse(),
    escrow: moola.issuer.makeEmptyPurse(),
  };

  for (const [name, purse] of Object.entries(placeholders)) {
    charts.moola.placePurse({
      sealedPurse: moola.sealer.seal(purse),
      name: name.charAt(0).toUpperCase() + name.slice(1),
      parentGuid: rootGuid,
      accountType: 'ASSET',
      placeholder: true,
    });
  }

  const parentGuids = {
    alice: moola.purses.getGuid(placeholders.alice),
    bob: moola.purses.getGuid(placeholders.bob),
    escrow: moola.purses.getGuid(placeholders.escrow),
  };

  // === AMIX STATE: Agreement ===
  // Create parties
  const parties = {
    alice: makeParty(
      moola.issuer,
      stock.issuer,
      moola.sealer,
      stock.sealer,
    ),
    bob: makeParty(
      moola.issuer,
      stock.issuer,
      moola.sealer,
      stock.sealer,
    ),
  };

  // Create escrow using escrow-ertp
  const escrow = makeErtpEscrow({
    issuers: { A: moola.issuer, B: stock.issuer },
    sealers: { A: moola.sealer, B: stock.sealer },
  });

  // Place party purses in chart
  for (const [name, party] of Object.entries(parties)) {
    const parentGuid = parentGuids[name as keyof typeof parentGuids];
    charts.moola.placePurse({
      sealedPurse: party.getSealedMoola(),
      name: 'Moola',
      parentGuid,
      accountType: 'ASSET',
    });
    charts.stock.placePurse({
      sealedPurse: party.getSealedStock(),
      name: 'Stock',
      parentGuid,
      accountType: 'STOCK',
    });
  }

  // Place escrow purses in chart
  const sealedEscrow = escrow.getSealedPurses();
  charts.moola.placePurse({
    sealedPurse: sealedEscrow.A,
    name: 'Moola',
    parentGuid: parentGuids.escrow,
    accountType: 'ASSET',
  });
  charts.stock.placePurse({
    sealedPurse: sealedEscrow.B,
    name: 'Stock',
    parentGuid: parentGuids.escrow,
    accountType: 'STOCK',
  });

  // Track splits incrementally - only show new splits at each state
  const tracker = makeSplitTracker(db);
  tracker.getNewSplits(); // Clear any setup splits

  // Fund parties' purses (they receive assets from elsewhere)
  parties.alice.getMoolaDeposit().receive(moola.mint.mintPayment(moolaAmt(10n)));
  parties.bob.getStockDeposit().receive(stock.mint.mintPayment(stockAmt(1n)));
  tracker.getNewSplits(); // Clear funding splits

  // Build offers - A gives moola, wants stock; B gives stock, wants moola
  const offers = freeze({
    A: parties.alice.offer(moolaAmt(10n), stockAmt(1n), parties.alice.getStockDeposit()),
    B: parties.bob.offer(stockAmt(1n), moolaAmt(10n), parties.bob.getMoolaDeposit()),
  });

  t.snapshot(
    toRowStrings(tracker.getNewSplits(), splitColumns),
    `Escrow follows the AMIX state machine (American Information Exchange, 1984).
AMIX models exchange as: Agreement → Funding → Settlement (or Cancellation).

STATE: Agreement
Parties and escrow exist. Offers are defined but not yet accepted.
No ledger changes yet.`,
  );

  // === AMIX STATE: Funding ===
  // Start the exchange - escrow waits for payments
  const exchangeP = escrow.escrowExchange(offers.A.party, offers.B.party);

  // Parties fund in any order (sequential here for observable intermediate states)
  await offers.A.run();
  await offers.A.deposited;
  t.snapshot(
    toRowStrings(tracker.getNewSplits(), splitColumns),
    `STATE: Alice Funds (first mover)
Alice accepts her offer and funds escrow with 10 Moola.
Escrow now holds moola; still waiting for Bob.`,
  );

  await offers.B.run();
  await offers.B.deposited;
  t.snapshot(
    toRowStrings(tracker.getNewSplits(), splitColumns),
    `STATE: Bob Funds (second mover)
Bob accepts his offer and funds escrow with 1 Stock.
Both parties funded - escrow settles.`,
  );

  // Settlement
  await exchangeP;
  t.snapshot(
    toRowStrings(tracker.getNewSplits(), splitColumns),
    `STATE: Settlement
Alice gets Stock (what she wanted); Bob gets Moola (what he wanted).`,
  );
});

serial('Settlement links transactions (SettlementFacet)', async t => {
  const { freeze } = Object;
  const { db, close } = makeTestDb();
  t.teardown(close);

  const makeGuid = mockMakeGuid();
  const now = makeTestClock(Date.UTC(2026, 0, 26, 0, 0), 1);

  const makeKit = (mnemonic: string, namespace: 'CURRENCY' | 'COMMODITY') =>
    createIssuerKit(
      freeze({
        db,
        commodity: freeze({ namespace, mnemonic }),
        makeGuid,
        nowMs: now,
      }),
    );

  const moola = makeKit('Moola', 'CURRENCY');
  const stock = makeKit('Stock', 'COMMODITY');

  const moolaAmt = (v: bigint) => freeze({ brand: moola.brand, value: v });
  const stockAmt = (v: bigint) => freeze({ brand: stock.brand, value: v });

  // Create parties with purses
  const parties = {
    alice: makeParty(moola.issuer, stock.issuer, moola.sealer, stock.sealer),
    bob: makeParty(moola.issuer, stock.issuer, moola.sealer, stock.sealer),
  };

  // Create escrow
  const escrow = makeErtpEscrow({
    issuers: { A: moola.issuer, B: stock.issuer },
    sealers: { A: moola.sealer, B: stock.sealer },
  });

  // Fund parties
  parties.alice.getMoolaDeposit().receive(moola.mint.mintPayment(moolaAmt(10n)));
  parties.bob.getStockDeposit().receive(stock.mint.mintPayment(stockAmt(1n)));

  // Build offers
  const offers = freeze({
    A: parties.alice.offer(
      moolaAmt(10n),
      stockAmt(1n),
      parties.alice.getStockDeposit(),
    ),
    B: parties.bob.offer(
      stockAmt(1n),
      moolaAmt(10n),
      parties.bob.getMoolaDeposit(),
    ),
  });

  // SettlementFacet consolidates settlement into one GnuCash transaction
  let refCounter = 0;
  const settlement = makeSettlementFacet({
    db,
    currencyGuid: moola.commodityGuid,
    makeSettlementRef: () => `SETTLE-${String(++refCounter).padStart(4, '0')}`,
  });

  // Start exchange - parties fund
  const exchangeP = escrow.escrowExchange(offers.A.party, offers.B.party);
  await offers.A.run();
  await offers.B.run();

  // SettlementFacet consolidates the ERTP deposits into one GnuCash transaction
  const { settlementRef, txGuid } = await settlement.settle(
    () => exchangeP,
    'Alice buys 1 Stock from Bob for 10 Moola',
  );

  // Query the consolidated transaction and its splits
  const tx = db
    .prepare<[string], { guid: string; num: string; description: string }>(
      'SELECT guid, num, description FROM transactions WHERE guid = ?',
    )
    .get(txGuid!)!;

  const splits = db
    .prepare<
      [string],
      { account_guid: string; value_num: string; quantity_num: string }
    >(
      `SELECT s.account_guid, s.value_num, s.quantity_num
       FROM splits s WHERE s.tx_guid = ? ORDER BY s.value_num DESC`,
    )
    .all(txGuid!)
    .map(shortGuids(['account_guid']));

  t.snapshot(
    {
      transaction: `${shortGuid(tx.guid)} | ${tx.num} | ${tx.description}`,
      splits: toRowStrings(splits, ['account_guid', 'value_num', 'quantity_num']),
    },
    `SettlementFacet consolidates ERTP settlements into one GnuCash transaction.
Like ChartFacet names accounts, SettlementFacet handles GnuCash stock-trade format.

ERTP escrow creates separate transactions per commodity. SettlementFacet folds
them into one transaction with 4 splits - proper GnuCash stock-trade format.
Value is in currency (Moola); quantity is in account commodity.`,
  );

  t.is(settlementRef, 'SETTLE-0001');
  t.is(splits.length, 4, 'Consolidated transaction has 4 splits');
});

test.todo('Multi-commodity swaps: show ledger rows for two brands');
