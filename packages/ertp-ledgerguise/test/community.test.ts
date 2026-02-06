/**
 * @file Community chart scenario for contributor awards.
 *
 * Story: a small community awards contribution tokens and wants member names
 * in the ledger. Each member gets a purse (asset account) placed under a
 * community root account; expenses remain a later refinement. See CONTRIBUTING
 * for chart evolution ideas (Flow B, periodic minting).
 *
 * If ERTP_DB is set, the test writes the sqlite database at that path.
 */

import test from 'ava';
import type { TestFn } from 'ava';
import Database from 'better-sqlite3';
import type { SqlDatabase } from '../src/sql-db.js';
import type { Brand, NatAmount, Purse } from '../src/ertp-types.js';
import type { Guid } from '../src/types.js';
import {
  createIssuerKit,
  initGnuCashSchema,
  makeChartFacet,
  wrapBetterSqlite3Database,
} from '../src/index.js';
// Direct import of deprecated escrow (pending migration to makeErtpEscrow)
import { makeEscrow } from '../src/escrow.js';
import { makeDeterministicGuid, mockMakeGuid } from '../src/guids.js';
import { makeTestClock } from './mock-io.js';

type CommunityContext = {
  db: SqlDatabase;
  closeDb: () => void;
  kit: ReturnType<typeof createIssuerKit>;
  chart: ReturnType<typeof makeChartFacet>;
  escrow: ReturnType<typeof makeEscrow>;
  brand: Brand<'nat'>;
  bucks: (value: bigint) => NatAmount;
};

const sharedState: {
  rootPurse?: Purse<'nat'>;
  rootGuid?: Guid;
  treasuryPurse?: Purse<'nat'>;
  workPurse?: Purse<'nat'>;
  inParentGuid?: Guid;
  outParentGuid?: Guid;
  inPurses: Map<string, Purse<'nat'>>;
  outPurses: Map<string, Purse<'nat'>>;
} = {
  inPurses: new Map(),
  outPurses: new Map(),
};

const serial = test.serial as TestFn<CommunityContext>;

const getTotalForAccountType = (
  db: SqlDatabase,
  commodityGuid: Guid,
  accountType: string,
  excludeGuids: Guid[] = [],
) => {
  const filters = excludeGuids.length
    ? ` AND accounts.guid NOT IN (${excludeGuids.map(() => '?').join(', ')})`
    : '';
  const row = db
    .prepare(`
      SELECT COALESCE(SUM(quantity_num), 0) AS total
      FROM splits JOIN accounts ON splits.account_guid = accounts.guid
      WHERE accounts.account_type = ? AND accounts.commodity_guid = ?${filters}
    `)
    .get(
      ...([accountType, commodityGuid, ...excludeGuids] as string[]),
    ) as { total: string } | undefined;
  return BigInt(row?.total ?? '0');
};
const toRowStrings = (
  rows: Record<string, string>[],
  columns: string[],
): string[] => {
  const widths = columns.map(column =>
    Math.max(column.length, ...rows.map(row => String(row[column] ?? '').length)),
  );
  const format = (row: Record<string, string>) =>
    columns.map((column, index) => String(row[column] ?? '').padEnd(widths[index])).join(' | ');
  const header = Object.fromEntries(columns.map(column => [column, column]));
  return [format(header), ...rows.map(format)];
};
const shortGuid = (value: string) => value.slice(-12);

serial.before(t => {
  const { freeze } = Object;
  const dbPath = process.env.ERTP_DB ?? ':memory:';
  const rawDb = new Database(dbPath);
  const db = wrapBetterSqlite3Database(rawDb);
  initGnuCashSchema(db);

  const makeGuid = mockMakeGuid();
  const nowMs = makeTestClock(Date.UTC(2020, 0, 1, 9, 15), 1);
  const commodity = freeze({ namespace: 'COMMODITY', mnemonic: 'BUCKS' });
  const kit = createIssuerKit(freeze({ db, commodity, makeGuid, nowMs }));
  const chart = makeChartFacet({
    db,
    commodityGuid: kit.commodityGuid,
    getGuidFromSealed: kit.purses.getGuidFromSealed,
  });
  const { sealer } = kit;
  const escrow = makeEscrow({
    db,
    commodityGuid: kit.commodityGuid,
    holdingAccountGuid: makeDeterministicGuid(`ledgerguise-balance:${kit.commodityGuid}`),
    getPurseGuid: kit.purses.getGuid,
    brand: kit.brand,
    makeGuid,
    nowMs,
  });
  const brand = kit.brand as Brand<'nat'>;
  const bucks = (value: bigint): NatAmount => freeze({ brand, value });

  t.context = {
    db,
    closeDb: () => rawDb.close(),
    kit,
    chart,
    escrow,
    brand,
    bucks,
  };
});

serial.after(t => {
  t.context.closeDb();
});

serial('stage 1: create the community root account', t => {
  const { chart, kit, bucks } = t.context as CommunityContext;
  const { sealer } = kit;
  const rootPurse = kit.issuer.makeEmptyPurse();
  const gnucashRoot = t.context.db
    .prepare<[], { root_account_guid: string }>(
      'SELECT root_account_guid FROM books LIMIT 1',
    )
    .get();
  t.truthy(gnucashRoot?.root_account_guid);
  // GnuCash only shows commodity balances under STOCK/MUTUAL-style subtrees.
  chart.placePurse({
    sealedPurse: sealer.seal(rootPurse),
    name: 'Org1',
    parentGuid: gnucashRoot!.root_account_guid as Guid,
    accountType: 'STOCK',
  });
  const rootGuid = kit.purses.getGuid(rootPurse);
  sharedState.rootPurse = rootPurse;
  sharedState.rootGuid = rootGuid;

  const mintParentPurse = kit.issuer.makeEmptyPurse();
  const commodityLabel = kit.brand.getAllegedName();
  chart.placePurse({
    sealedPurse: sealer.seal(mintParentPurse),
    name: `${commodityLabel} Mint`,
    parentGuid: gnucashRoot!.root_account_guid as Guid,
    accountType: 'STOCK',
    placeholder: true,
  });
  const mintParentGuid = kit.purses.getGuid(mintParentPurse);
  const { holdingAccountGuid, recoveryPurseGuid } = kit.mintInfo.getMintInfo();
  chart.placeAccount({
    accountGuid: holdingAccountGuid,
    name: `${commodityLabel} Mint Holding`,
    parentGuid: mintParentGuid,
    accountType: 'STOCK',
  });
  chart.placePurse({
    sealedPurse: sealer.seal(kit.mintRecoveryPurse),
    name: `${commodityLabel} Mint Recovery`,
    parentGuid: mintParentGuid,
    accountType: 'STOCK',
  });

  const treasuryPurse = kit.issuer.makeEmptyPurse();
  chart.placePurse({
    sealedPurse: sealer.seal(treasuryPurse),
    name: 'Treasury',
    parentGuid: rootGuid,
    accountType: 'STOCK',
  });
  const treasuryPayment = kit.mint.mintPayment(bucks(10_000n));
  treasuryPurse.deposit(treasuryPayment);
  sharedState.treasuryPurse = treasuryPurse;

  const workPurse = kit.issuer.makeEmptyPurse();
  chart.placePurse({
    sealedPurse: sealer.seal(workPurse),
    name: 'Work',
    parentGuid: rootGuid,
    accountType: 'STOCK',
  });
  sharedState.workPurse = workPurse;

  const row = t.context.db
    .prepare<[string], { name: string; account_type: string }>(
      'SELECT name, account_type FROM accounts WHERE guid = ?',
    )
    .get(rootGuid);
  t.is(row?.name, 'Org1');
  t.is(row?.account_type, 'STOCK');
});

serial('stage 2: add member purses to the chart', t => {
  const { chart, kit } = t.context as CommunityContext;
  const { sealer } = kit;
  t.truthy(sharedState.rootGuid);
  const inPurse = kit.issuer.makeEmptyPurse();
  chart.placePurse({
    sealedPurse: sealer.seal(inPurse),
    name: 'In',
    parentGuid: sharedState.rootGuid,
    accountType: 'STOCK',
  });
  const inGuid = kit.purses.getGuid(inPurse);
  sharedState.inParentGuid = inGuid;
  const outPurse = kit.issuer.makeEmptyPurse();
  chart.placePurse({
    sealedPurse: sealer.seal(outPurse),
    name: 'Out',
    parentGuid: sharedState.rootGuid,
    accountType: 'STOCK',
  });
  const outGuid = kit.purses.getGuid(outPurse);
  sharedState.outParentGuid = outGuid;
  const members = ['Alice', 'Bob', 'Carol', 'Dave', 'Peggy', 'Mallory', 'Eve'];
  for (const name of members) {
    const inMember = kit.issuer.makeEmptyPurse();
    chart.placePurse({
      sealedPurse: sealer.seal(inMember),
      name,
      parentGuid: inGuid,
      accountType: 'STOCK',
    });
    sharedState.inPurses.set(name, inMember);
    const outMember = kit.issuer.makeEmptyPurse();
    chart.placePurse({
      sealedPurse: sealer.seal(outMember),
      name,
      parentGuid: outGuid,
      accountType: 'STOCK',
    });
    sharedState.outPurses.set(name, outMember);
  }

  const aliceGuid = kit.purses.getGuid(sharedState.outPurses.get('Alice')!);
  const row = t.context.db
    .prepare<[string], { name: string; parent_guid: string | null }>(
      'SELECT name, parent_guid FROM accounts WHERE guid = ?',
    )
    .get(aliceGuid);
  t.is(row?.name, 'Alice');
  t.is(row?.parent_guid, sharedState.outParentGuid);
});

serial('stage 3: award contributions to members', t => {
  const { kit, bucks, escrow } = t.context as CommunityContext;
  const treasury = sharedState.treasuryPurse!;
  const workPurse = sharedState.workPurse!;
  const members = ['Alice', 'Bob', 'Carol', 'Dave', 'Peggy', 'Mallory', 'Eve'];
  const contributionsByWeek = [
    [1, 0, 2, 0, 1, 0, 3],
    [0, 1, 0, 2, 0, 1, 3],
    [2, 0, 1, 0, 2, 0, 2],
  ];
  const totalsByMember = new Map<string, bigint>();
  for (const name of members) {
    totalsByMember.set(name, 0n);
  }
  let issueCounter = 123;
  const issueValue = (issueNumber: number) => BigInt(1 + ((issueNumber - 123) % 5));
  const issueSubjects = [
    'improve treasury report',
    'refactor chart placement',
    'audit mint recovery',
    'document escrow flow',
    'tighten adversarial tests',
  ];
  const issueDescription = (issueNumber: number) =>
    `#${issueNumber}: ${issueSubjects[(issueNumber - 123) % issueSubjects.length]}`;
  const award = (name: string, count: number) => {
    const inPurse = sharedState.inPurses.get(name)!;
    const outPurse = sharedState.outPurses.get(name)!;
    for (let i = 0; i < count; i += 1) {
      const value = issueValue(issueCounter);
      const offer = escrow.makeOffer(
        { fromPurse: inPurse, toPurse: workPurse, amount: bucks(value) },
        { fromPurse: treasury, toPurse: outPurse, amount: bucks(value) },
        `issue-${issueCounter}`,
        issueDescription(issueCounter),
      );
      issueCounter += 1;
      offer.accept();
      totalsByMember.set(name, totalsByMember.get(name)! + value);
    }
  };
  for (const week of contributionsByWeek) {
    for (const [index, count] of week.entries()) {
      const name = members[index];
      award(name, count);
    }
  }
  for (const name of members) {
    const outPurse = sharedState.outPurses.get(name)!;
    t.is(outPurse.getCurrentAmount().value, totalsByMember.get(name)!);
  }
});

serial('stage 4: run balance sheet and income statement', t => {
  const { db, kit } = t.context as CommunityContext;
  const holdingGuid = makeDeterministicGuid(`ledgerguise-balance:${kit.commodityGuid}`);
  const recoveryGuid = makeDeterministicGuid(`ledgerguise:recovery:${kit.commodityGuid}`);
  // Exclude holding/recovery from statement totals; they act as equity-like backing.
  t.is(
    getTotalForAccountType(db, kit.commodityGuid, 'STOCK', [
      holdingGuid,
      recoveryGuid,
    ]),
    10_000n,
  );
  t.is(getTotalForAccountType(db, kit.commodityGuid, 'EQUITY'), 0n);
  t.is(getTotalForAccountType(db, kit.commodityGuid, 'EXPENSE'), 0n);
  t.is(getTotalForAccountType(db, kit.commodityGuid, 'INCOME'), 0n);

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
  const book = db
    .prepare<[], { root_account_guid: string }>(
      'SELECT root_account_guid FROM books LIMIT 1',
    )
    .get();
  const rootGuid = book?.root_account_guid ?? '';
  t.snapshot(
    toRowStrings(
      accounts.map(row => ({
        guid: shortGuid(row.guid),
        name: row.name,
        parent_guid: row.parent_guid ? shortGuid(row.parent_guid) : '',
        account_type: row.account_type,
        placeholder: row.placeholder ? '1' : '0',
      })),
      ['guid', 'name', 'parent_guid', 'account_type', 'placeholder'],
    ),
    'accounts view',
  );

  const registerColumns = ['tx_guid', 'num', 'description', 'value_num', 'reconcile_state'];
  const accountByGuid = new Map(accounts.map(account => [account.guid, account]));
  const accountLabelCache = new Map<string, string>();
  const toAccountLabel = (guid: string): string => {
    const cached = accountLabelCache.get(guid);
    if (cached) return cached;
    const account = accountByGuid.get(guid);
    if (!account) return guid;
    const label =
      account.parent_guid && account.parent_guid !== '' && account.parent_guid !== rootGuid
        ? `${toAccountLabel(account.parent_guid)}:${account.name}`
        : account.name;
    accountLabelCache.set(guid, label);
    return label;
  };
  for (const account of accounts) {
    const registerRows = db
      .prepare<
        [string],
        {
          tx_guid: string;
          num: string;
          description: string;
          value_num: string;
          reconcile_state: string;
        }
      >(`
        SELECT splits.tx_guid, transactions.num, transactions.description,
          splits.value_num, splits.reconcile_state
        FROM splits JOIN transactions ON splits.tx_guid = transactions.guid
        WHERE splits.account_guid = ?
        ORDER BY splits.tx_guid, splits.guid
      `)
      .all(account.guid);
    t.snapshot(
      toRowStrings(
        registerRows.map(row => ({
          tx_guid: shortGuid(row.tx_guid),
          num: row.num,
          description: row.description,
          value_num: row.value_num,
          reconcile_state: row.reconcile_state,
        })),
        registerColumns,
      ),
      `register: ${toAccountLabel(account.guid)}`,
    );
  }

  const balanceSheetRows = ['STOCK', 'EQUITY'].map(accountType => ({
    account_type: accountType,
    total: getTotalForAccountType(db, kit.commodityGuid, accountType, [
      holdingGuid,
      recoveryGuid,
    ]).toString(),
  }));
  t.snapshot(
    toRowStrings(balanceSheetRows, ['account_type', 'total']),
    'balance sheet',
  );

  const incomeStatementRows = ['INCOME', 'EXPENSE'].map(accountType => ({
    account_type: accountType,
    total: getTotalForAccountType(db, kit.commodityGuid, accountType, [
      holdingGuid,
      recoveryGuid,
    ]).toString(),
  }));
  t.snapshot(
    toRowStrings(incomeStatementRows, ['account_type', 'total']),
    'income statement',
  );
});
