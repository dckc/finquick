/**
 * @file Snapshot-based design doc for ERTP->GnuCash mapping.
 */

import test from 'ava';
import type { ExecutionContext } from 'ava';
import type { TestFn } from 'ava';
import type { Brand, Issuer, NatAmount, Payment, Purse } from '../src/ertp-types.js';
import { createIssuerKit, makeChartFacet, wrapBetterSqlite3Database } from '../src/index.js';
import type { Guid } from '../src/types.js';
import { makeTestClock, mockMakeGuid, makeTestDb } from './mock-io.js';

type SealFn = { seal: (obj: unknown) => unknown };

const toRowStrings = (
  rows: Record<string, string>[],
  columns: string[],
): string[] => {
  if (rows.length === 0) return [columns.join(' | ')];
  const widths = columns.map(column =>
    Math.max(
      column.length,
      ...rows.map(row => String(row[column] ?? '').length),
    ),
  );
  const format = (row: Record<string, string>) =>
    columns
      .map((column, index) => String(row[column] ?? '').padEnd(widths[index]))
      .join(' | ');
  const header = Object.fromEntries(columns.map(column => [column, column]));
  return [format(header), ...rows.map(format)];
};

const shortGuid = (value: string) => value.slice(-12);

type DesignContext = {
  db: ReturnType<typeof wrapBetterSqlite3Database>;
  kit: ReturnType<typeof createIssuerKit>;
  purse: Purse<'nat'>;
};

let closeDb: (() => void) | undefined;

const withDesignContext = (t: ExecutionContext<DesignContext>) => {
  const { freeze } = Object;
  const { db, close } = makeTestDb();

  const makeGuid = mockMakeGuid();
  const nowMs = makeTestClock(Date.UTC(2026, 0, 24, 0, 0), 1);
  const commodity = freeze({ namespace: 'COMMODITY', mnemonic: 'BUCKS' });
  const kit = createIssuerKit(freeze({ db, commodity, makeGuid, nowMs }));
  const brand = kit.brand as Brand<'nat'>;
  const bucks = (value: bigint): NatAmount => freeze({ brand, value });

  const purse = kit.issuer.makeEmptyPurse();
  const payment = kit.mint.mintPayment(bucks(5n));
  purse.deposit(payment);

  closeDb = close;
  t.context = { db, kit, purse };
};

const serial = test.serial as TestFn<DesignContext>;

serial.before(withDesignContext);
serial.after(() => closeDb?.());

serial('Mint and deposit (minimal DB impact)', t => {
  const { db } = t.context;
  const txRows = db
    .prepare<
      [],
      {
        guid: string;
        num: string;
        post_date: string | null;
        enter_date: string | null;
      }
    >(`
      SELECT guid, num, post_date, enter_date
      FROM transactions
      ORDER BY guid
    `)
    .all()
    .map(row => ({
      guid: shortGuid(row.guid),
      num: row.num,
      post_date: row.post_date?.split(' ')[0] ?? '',
      enter_date: row.enter_date?.split(' ')[0] ?? '',
    }));
  const splitRows = db
    .prepare<
      [],
      {
        guid: string;
        tx_guid: string;
        account_guid: string;
        value_num: string;
        value_denom: string;
        reconcile_state: string;
      }
    >(`
      SELECT guid, tx_guid, account_guid, value_num, value_denom, reconcile_state
      FROM splits
      ORDER BY guid
    `)
    .all()
    .map(row => ({
      guid: shortGuid(row.guid),
      tx_guid: shortGuid(row.tx_guid),
      account_guid: shortGuid(row.account_guid),
      value_num: row.value_num,
      value_denom: row.value_denom,
      reconcile_state: row.reconcile_state,
    }));
  t.snapshot(
    toRowStrings(txRows, [
      'guid',
      'currency_guid',
      'num',
      'post_date',
      'enter_date',
      'description',
    ]),
`GnuCash is an accounting program; a bit like Quicken but based more on traditional double-entry accounting.
ERTP is a flexible Electronic Rights protocol.
ERTP is flexible enough that we can implement it on top of a GnuCash database.

We start with the smallest ERTP action that writes to the database: mint 5 BUCKS and deposit them into a purse.
This creates one transaction and two splits, moving value from the mint holding account into the purse.`,
  );
  t.snapshot(
    toRowStrings(splitRows, [
      'guid',
      'tx_guid',
      'account_guid',
      'value_num',
      'value_denom',
      'reconcile_state',
    ]),
`Splits show the value move: one positive into the purse account and one negative out of the mint holding account.

Context: before the deposit we already created issuer and purse records:
  const { issuer } = makeIssuerKit("BUCKS");
  const purse = issuer.makeEmptyPurse();

Those actions touch other tables too:
- createIssuerKit inserts a commodity row (BUCKS) and creates mint recovery/holding accounts.
- makeEmptyPurse inserts an account row for the new purse (later named via ChartFacet).`,
  );
});

serial('ERTP is separate from naming', t => {
  const { db, kit } = t.context;
  const accounts = db
    .prepare<
      [string],
      {
        guid: string;
        name: string;
        parent_guid: string | null;
        account_type: string;
        placeholder: number;
      }
    >(
`
        SELECT guid, name, parent_guid, account_type, placeholder
        FROM accounts
        WHERE commodity_guid = ?
        ORDER BY guid
      `,
    )
    .all(kit.commodityGuid);
  const accountsView = accounts
    .filter(row => row.name === row.guid)
    .map(row => ({
      guid: shortGuid(row.guid),
      name: row.name,
      parent_guid: row.parent_guid ? shortGuid(row.parent_guid) : '',
      account_type: row.account_type,
      placeholder: row.placeholder ? '1' : '0',
    }));
  t.snapshot(
    toRowStrings(accountsView, [
      'guid',
      'name',
      'parent_guid',
      'account_type',
      'placeholder',
    ]),
`ERTP mints are separate from human-facing names.
Anyone can create an ERTP \`Mint\`; if someone called it USD when it was not, that would be trouble.
Until a chart names accounts, the ledger is correct but opaque to humans.`,
  );
});

serial('Giving names in the chart of accounts', t => {
  const { db, kit, purse } = t.context;
  const root = db
    .prepare<[], { root_account_guid: string }>(
      'SELECT root_account_guid FROM books LIMIT 1',
    )
    .get();
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
    .prepare<
      [string],
      {
        guid: string;
        name: string;
        parent_guid: string | null;
        account_type: string;
        placeholder: number;
      }
    >(
`
        SELECT guid, name, parent_guid, account_type, placeholder
        FROM accounts
        WHERE commodity_guid = ?
        ORDER BY guid
      `,
    )
    .all(kit.commodityGuid)
    .map(row => ({
      guid: shortGuid(row.guid),
      name: row.name,
      parent_guid: row.parent_guid ? shortGuid(row.parent_guid) : '',
      account_type: row.account_type,
      placeholder: row.placeholder ? '1' : '0',
    }));
  t.snapshot(
    toRowStrings(accountsViewNamed, [
      'guid',
      'name',
      'parent_guid',
      'account_type',
      'placeholder',
    ]),
`makeIssuerKit("BUCKS") was a simplification.
The actual setup wires a chart facet so we can name accounts:
  const kit = createIssuerKit({ db, ... });
  const chart = makeChartFacet({ db, getGuidFromSealed: kit.purses.getGuidFromSealed, ... });
  chart.placePurse({ sealedPurse: kit.sealer.seal(purse), name: "Alice", ... });

Placing the purse under a parent account gives it a human name and a path (e.g., Org1:Alice).
The sealed token identifies the purse without leaking withdrawal authority.`,
  );
});

serial('Building account hierarchies with placeholder parents', t => {
  const { freeze } = Object;
  const { db, close } = makeTestDb();
  t.teardown(close);

  const makeGuid = mockMakeGuid();
  const now = makeTestClock(Date.UTC(2026, 0, 25, 0, 0), 1);

  const moolaKit = createIssuerKit(
    freeze({
      db,
      commodity: freeze({ namespace: 'COMMODITY', mnemonic: 'USD' }),
      makeGuid,
      nowMs: now,
    }),
  );

  const chart = makeChartFacet({
    db,
    commodityGuid: moolaKit.commodityGuid,
    getGuidFromSealed: moolaKit.purses.getGuidFromSealed,
  });
  const { sealer } = moolaKit;

  const root = db
    .prepare<[], { root_account_guid: string }>(
      'SELECT root_account_guid FROM books LIMIT 1',
    )
    .get();
  const rootGuid = root?.root_account_guid as Guid;

  // Build a traditional chart of accounts hierarchy with account codes
  const assets = moolaKit.issuer.makeEmptyPurse();
  const bank = moolaKit.issuer.makeEmptyPurse();
  const checking = moolaKit.issuer.makeEmptyPurse();
  const savings = moolaKit.issuer.makeEmptyPurse();
  const expenses = moolaKit.issuer.makeEmptyPurse();
  const food = moolaKit.issuer.makeEmptyPurse();

  chart.placePurse({ sealedPurse: sealer.seal(assets), name: 'Assets', parentGuid: rootGuid, accountType: 'ASSET', placeholder: true, code: '1000' });
  const assetsGuid = moolaKit.purses.getGuid(assets);

  chart.placePurse({ sealedPurse: sealer.seal(bank), name: 'Bank', parentGuid: assetsGuid, accountType: 'BANK', placeholder: true, code: '1100' });
  const bankGuid = moolaKit.purses.getGuid(bank);

  chart.placePurse({ sealedPurse: sealer.seal(checking), name: 'Checking', parentGuid: bankGuid, accountType: 'BANK', code: '1110' });
  chart.placePurse({ sealedPurse: sealer.seal(savings), name: 'Savings', parentGuid: bankGuid, accountType: 'BANK', code: '1120' });

  chart.placePurse({ sealedPurse: sealer.seal(expenses), name: 'Expenses', parentGuid: rootGuid, accountType: 'EXPENSE', placeholder: true, code: '6000' });
  const expensesGuid = moolaKit.purses.getGuid(expenses);

  chart.placePurse({ sealedPurse: sealer.seal(food), name: 'Food', parentGuid: expensesGuid, accountType: 'EXPENSE', code: '6100' });

  // Query showing how guid/parent_guid form the tree, with codes for cross-system integration
  const accounts = db
    .prepare<
      [string],
      { guid: string; name: string; parent_guid: string | null; placeholder: number; code: string | null }
    >(
      `SELECT guid, name, parent_guid, placeholder, code
       FROM accounts
       WHERE commodity_guid = ?
       ORDER BY code, name`,
    )
    .all(moolaKit.commodityGuid)
    .filter(row => !row.name.includes('Mint')) // exclude internal accounts
    .map(row => ({
      guid: shortGuid(row.guid),
      code: row.code ?? '',
      name: row.name,
      parent_guid: row.parent_guid ? shortGuid(row.parent_guid) : '',
      placeholder: row.placeholder ? 'Y' : '',
    }));

  t.snapshot(
    toRowStrings(accounts, ['guid', 'code', 'name', 'parent_guid', 'placeholder']),
`The accounts table forms a tree via guid and parent_guid columns.
Account codes (1000, 1100, etc.) enable cross-system integration.
Placeholder accounts (Y) group children; leaf accounts hold balances.

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
    .prepare<
      [],
      {
        guid: string;
        currency_guid: string;
        num: string;
        post_date: string | null;
        enter_date: string | null;
        description: string;
      }
    >(`
      SELECT guid, currency_guid, num, post_date, enter_date, description
      FROM transactions
      ORDER BY guid
    `,
    )
    .all()
    .map(row => ({
      guid: shortGuid(row.guid),
      currency_guid: shortGuid(row.currency_guid),
      num: row.num,
      post_date: row.post_date?.split(' ')[0] ?? '',
      enter_date: row.enter_date?.split(' ')[0] ?? '',
      description: row.description,
    }));
  const splitRows = db
    .prepare<
      [],
      {
        guid: string;
        tx_guid: string;
        account_guid: string;
        account_name: string;
        value_num: string;
        value_denom: string;
        reconcile_state: string;
      }
    >(
`
        SELECT splits.guid, splits.tx_guid, splits.account_guid, accounts.name AS account_name,
          splits.value_num, splits.value_denom, splits.reconcile_state
        FROM splits JOIN accounts ON splits.account_guid = accounts.guid
        ORDER BY splits.guid
      `,
    )
    .all()
    .map(row => ({
      guid: shortGuid(row.guid),
      tx_guid: shortGuid(row.tx_guid),
      account_guid: shortGuid(row.account_guid),
      account_name: row.account_name,
      value_num: row.value_num,
      value_denom: row.value_denom,
      reconcile_state: row.reconcile_state,
    }));
  t.snapshot(
    toRowStrings(txRows, [
      'guid',
      'num',
      'post_date',
      'enter_date',
    ]),
`Withdraw removes value from the purse by creating a new hold transaction, in addition to the earlier mint/deposit transaction.
The split table shows the line items for that new transaction.
The hold keeps value in a dedicated holding account until deposit or cancel.`,
  );
  t.snapshot(
    toRowStrings(splitRows, [
      'guid',
      'tx_guid',
      'account_guid',
      'account_name',
      'value_num',
      'value_denom',
      'reconcile_state',
    ]),
    'Hold splits show the value leaving the purse and landing in the holding account.',
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
      .prepare<[], { guid: string; name: string; parent_guid: string | null }>(
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

  const getAllSplits = () => {
    const pathMap = buildPathMap();
    return db
      .prepare<
        [],
        {
          split_guid: string;
          tx_guid: string;
          account_guid: string;
          value_num: string;
          value_denom: string;
          reconcile_state: string;
        }
      >(
        `
        SELECT s.guid as split_guid, s.tx_guid, s.account_guid,
               s.value_num, s.value_denom, s.reconcile_state
        FROM splits s
        ORDER BY s.tx_guid, s.account_guid
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
      return newSplits.map(row => ({
        tx_guid: shortGuid(row.tx_guid),
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
 * Factory for a party (Alice or Bob) with encapsulated purses.
 * Follows POLA: purses are private, only deposit facets and sealed tokens exposed.
 * Returns sealed tokens for chart placement - party doesn't need chart authority.
 */
const makeParty = ({
  name,
  moolaIssuer,
  stockIssuer,
  moolaSealer,
  stockSealer,
}: {
  name: string;
  moolaIssuer: Issuer<'nat'>;
  stockIssuer: Issuer<'nat'>;
  moolaSealer: SealFn;
  stockSealer: SealFn;
}) => {
  const { freeze } = Object;
  // Private purses - not leaked to test scope
  const moola = moolaIssuer.makeEmptyPurse();
  const stock = stockIssuer.makeEmptyPurse();

  return freeze({
    name,
    // Sealed tokens for chart placement (no withdrawal authority)
    sealedMoola: moolaSealer.seal(moola),
    sealedStock: stockSealer.seal(stock),
    // Deposit facets for receiving funds (safe to share)
    moolaDeposit: moola.getDepositFacet(),
    stockDeposit: stock.getDepositFacet(),
    // Funding escrow: party withdraws internally, returns payment
    fundMoola: (amount: NatAmount) => moola.withdraw(amount),
    fundStock: (amount: NatAmount) => stock.withdraw(amount),
    // Inspection (safe to share)
    getBalances: () => ({
      moola: moola.getCurrentAmount(),
      stock: stock.getCurrentAmount(),
    }),
  });
};

/**
 * Factory for escrow holder with encapsulated purses.
 * Escrow owns its purses; parties interact via deposit facets.
 * Returns sealed tokens for chart placement.
 */
const makeEscrowHolder = ({
  moolaIssuer,
  stockIssuer,
  moolaSealer,
  stockSealer,
}: {
  moolaIssuer: Issuer<'nat'>;
  stockIssuer: Issuer<'nat'>;
  moolaSealer: SealFn;
  stockSealer: SealFn;
}) => {
  const { freeze } = Object;
  const moola = moolaIssuer.makeEmptyPurse();
  const stock = stockIssuer.makeEmptyPurse();

  return freeze({
    // Sealed tokens for chart placement
    sealedMoola: moolaSealer.seal(moola),
    sealedStock: stockSealer.seal(stock),
    // Deposit facets for parties to fund escrow
    moolaDeposit: moola.getDepositFacet(),
    stockDeposit: stock.getDepositFacet(),
    // Settlement: escrow withdraws and pays out
    settleTo: (alice: ReturnType<typeof makeParty>, bob: ReturnType<typeof makeParty>, amounts: { stock: NatAmount; moola: NatAmount }) => {
      const stockPayment = stock.withdraw(amounts.stock);
      const moolaPayment = moola.withdraw(amounts.moola);
      alice.stockDeposit.receive(stockPayment);
      bob.moolaDeposit.receive(moolaPayment);
    },
  });
};

serial('Escrow exchange: async funding (AMIX-style state machine)', async t => {
  const { freeze } = Object;
  const { db, close } = makeTestDb();
  t.teardown(close);

  const makeGuid = mockMakeGuid();
  const now = makeTestClock(Date.UTC(2026, 0, 25, 0, 0), 1);

  const makeKit = (mnemonic: string) =>
    createIssuerKit(freeze({
      db,
      commodity: freeze({ namespace: 'COMMODITY', mnemonic }),
      makeGuid,
      nowMs: now,
    }));

  const moola = makeKit('Moola');
  const stock = makeKit('Stock');

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
    .prepare<[], { root_account_guid: string }>(
      'SELECT root_account_guid FROM books LIMIT 1',
    )
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

  // Create encapsulated actors - purses are private to each
  const partyConfig = {
    moolaIssuer: moola.issuer,
    stockIssuer: stock.issuer,
    moolaSealer: moola.sealer,
    stockSealer: stock.sealer,
  };
  const parties = {
    alice: makeParty({ name: 'Alice', ...partyConfig }),
    bob: makeParty({ name: 'Bob', ...partyConfig }),
  };

  // Place party purses in chart (parties return sealed tokens, don't need chart authority)
  for (const [name, party] of Object.entries(parties)) {
    const parentGuid = parentGuids[name as keyof typeof parentGuids];
    charts.moola.placePurse({ sealedPurse: party.sealedMoola, name: 'Moola', parentGuid, accountType: 'ASSET' });
    charts.stock.placePurse({ sealedPurse: party.sealedStock, name: 'Stock', parentGuid, accountType: 'STOCK' });
  }

  // Track splits incrementally - only show new splits at each state
  const tracker = makeSplitTracker(db);
  tracker.getNewSplits(); // Clear any setup splits

  // === SETUP: Parties have assets in their purses ===
  parties.alice.moolaDeposit.receive(moola.mint.mintPayment(moolaAmt(10n)));
  parties.bob.stockDeposit.receive(stock.mint.mintPayment(stockAmt(1n)));
  tracker.getNewSplits(); // Clear setup splits

  // === AMIX STATE: Agreement ===
  // Escrow is created. Parties will provide Promise<Payment>, not immediate payments.
  // This models async funding: Alice may fund before Bob, or vice versa.
  const escrow = makeEscrowHolder(partyConfig);

  // Place escrow purses in chart
  charts.moola.placePurse({ sealedPurse: escrow.sealedMoola, name: 'Moola', parentGuid: parentGuids.escrow, accountType: 'ASSET' });
  charts.stock.placePurse({ sealedPurse: escrow.sealedStock, name: 'Stock', parentGuid: parentGuids.escrow, accountType: 'STOCK' });

  // Deferred resolvers - these simulate async funding decisions
  let resolveAliceFunding!: (payment: Payment<'nat'>) => void;
  let resolveBobFunding!: (payment: Payment<'nat'>) => void;
  const aliceFundingP = new Promise<Payment<'nat'>>(r => { resolveAliceFunding = r; });
  const bobFundingP = new Promise<Payment<'nat'>>(r => { resolveBobFunding = r; });

  // Escrow starts waiting for both deposits (via promises)
  const escrowDepositPs = {
    moola: aliceFundingP.then(p => escrow.moolaDeposit.receive(p)),
    stock: bobFundingP.then(p => escrow.stockDeposit.receive(p)),
  };

  t.snapshot(
    toRowStrings(tracker.getNewSplits(), splitColumns),
`Escrow follows the AMIX state machine (American Information Exchange, 1984).
AMIX models exchange as: Agreement → Funding → Settlement (or Cancellation).

STATE: Agreement
Escrow purses exist but are empty. Both parties hold Promise<Payment>.
Funding happens asynchronously - Alice may fund before Bob, or vice versa.
No ledger changes yet.`,
  );

  // === AMIX STATE: Alice funds (first mover) ===
  const alicePayment = parties.alice.fundMoola(moolaAmt(10n));
  resolveAliceFunding(alicePayment);
  await escrowDepositPs.moola; // Wait for Alice's deposit to complete

  t.snapshot(
    toRowStrings(tracker.getNewSplits(), splitColumns),
`STATE: Alice Funds (first mover)
Alice withdraws from her purse and deposits to escrow.
Her payment creates a hold, then deposit retargets it to escrow.
Escrow now holds 10 Moola; still waiting for Bob.`,
  );

  // === AMIX STATE: Bob funds (second mover) ===
  const bobPayment = parties.bob.fundStock(stockAmt(1n));
  resolveBobFunding(bobPayment);
  await escrowDepositPs.stock; // Wait for Bob's deposit to complete

  t.snapshot(
    toRowStrings(tracker.getNewSplits(), splitColumns),
`STATE: Bob Funds (second mover)
Bob withdraws from his purse and deposits to escrow.
His payment creates a hold, then deposit retargets it to escrow.
Both parties funded - escrow can now settle.`,
  );

  // === AMIX STATE: Settlement ===
  // In real escrow, this happens automatically via Promise.all resolution.
  // Here we manually perform the settlement to show the ledger changes.
  escrow.settleTo(parties.alice, parties.bob, { stock: stockAmt(1n), moola: moolaAmt(10n) });

  t.snapshot(
    toRowStrings(tracker.getNewSplits(), splitColumns),
`STATE: Settlement
Escrow pays out to counterparties.
Alice gets Stock (what she wanted); Bob gets Moola (what he wanted).
Four new splits: escrow withdraws create holds, deposits finalize them.`,
  );
});

test.todo('Multi-commodity swaps: show ledger rows for two brands');
