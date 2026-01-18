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

import test, { TestFn } from 'ava';
import Database from 'better-sqlite3';
import type { Brand, NatAmount } from '@agoric/ertp';
import type { Guid } from '../src/types';
import { asGuid, createIssuerKit, initGnuCashSchema, makeChartFacet } from '../src/index';
import { makeTestClock } from './helpers/clock';

type PurseLike = ReturnType<ReturnType<typeof createIssuerKit>['issuer']['makeEmptyPurse']>;

type CommunityContext = {
  db: import('better-sqlite3').Database;
  kit: ReturnType<typeof createIssuerKit>;
  chart: ReturnType<typeof makeChartFacet>;
  brand: Brand<'nat'>;
  bucks: (value: bigint) => NatAmount;
  members: Map<string, PurseLike>;
};

const sharedState: {
  rootPurse?: PurseLike;
  rootGuid?: Guid;
  members: Map<string, PurseLike>;
} = { members: new Map() };

const serial = test.serial as TestFn<CommunityContext>;

const getTotalForAccountType = (
  db: import('better-sqlite3').Database,
  commodityGuid: Guid,
  accountType: string,
) => {
  const row = db
    .prepare<[string, string], { total: string }>(
      [
        'SELECT COALESCE(SUM(quantity_num), 0) AS total',
        'FROM splits JOIN accounts ON splits.account_guid = accounts.guid',
        "WHERE accounts.account_type = ? AND accounts.commodity_guid = ?",
      ].join(' '),
    )
    .get(accountType, commodityGuid);
  return BigInt(row?.total ?? '0');
};

serial.before(t => {
  const { freeze } = Object;
  const dbPath = process.env.ERTP_DB ?? ':memory:';
  const db = new Database(dbPath);
  initGnuCashSchema(db);

  let guidCounter = 0n;
  const makeGuid = () => {
    const guid = guidCounter;
    guidCounter += 1n;
    return asGuid(guid.toString(16).padStart(32, '0'));
  };
  const nowMs = makeTestClock();
  const commodity = freeze({ namespace: 'COMMODITY', mnemonic: 'BUCKS' });
  const kit = createIssuerKit(freeze({ db, commodity, makeGuid, nowMs }));
  const chart = makeChartFacet({
    db,
    commodityGuid: kit.commodityGuid,
    getPurseGuid: kit.purses.getGuid,
  });
  const brand = kit.brand as Brand<'nat'>;
  const bucks = (value: bigint): NatAmount => freeze({ brand, value });

  t.context = {
    db,
    kit,
    chart,
    brand,
    bucks,
    members: sharedState.members,
  };
});

serial.after(t => {
  t.context.db.close();
});

serial('stage 1: create the community root account', t => {
  const { chart, kit } = t.context as CommunityContext;
  const rootPurse = kit.issuer.makeEmptyPurse();
  const gnucashRoot = t.context.db
    .prepare<[], { root_account_guid: string }>(
      'SELECT root_account_guid FROM books LIMIT 1',
    )
    .get();
  t.truthy(gnucashRoot?.root_account_guid);
  chart.placePurse({
    purse: rootPurse,
    name: 'Community Root',
    parentGuid: gnucashRoot!.root_account_guid as Guid,
    accountType: 'EQUITY',
  });
  const rootGuid = kit.purses.getGuid(rootPurse);
  sharedState.rootPurse = rootPurse;
  sharedState.rootGuid = rootGuid;

  const row = t.context.db
    .prepare<[string], { name: string; account_type: string }>(
      'SELECT name, account_type FROM accounts WHERE guid = ?',
    )
    .get(rootGuid);
  t.is(row?.name, 'Community Root');
  t.is(row?.account_type, 'EQUITY');
});

serial('stage 2: add member purses to the chart', t => {
  const { chart, kit } = t.context as CommunityContext;
  t.truthy(sharedState.rootGuid);
  const members = ['Alice', 'Bob', 'Carol'];
  for (const name of members) {
    const purse = kit.issuer.makeEmptyPurse();
    chart.placePurse({
      purse,
      name,
      parentGuid: sharedState.rootGuid,
      accountType: 'ASSET',
    });
    sharedState.members.set(name, purse);
  }

  const aliceGuid = kit.purses.getGuid(sharedState.members.get('Alice')!);
  const row = t.context.db
    .prepare<[string], { name: string; parent_guid: string | null }>(
      'SELECT name, parent_guid FROM accounts WHERE guid = ?',
    )
    .get(aliceGuid);
  t.is(row?.name, 'Alice');
  t.is(row?.parent_guid, sharedState.rootGuid);
});

serial('stage 3: award contributions to members', t => {
  const { kit, bucks } = t.context as CommunityContext;
  const alice = sharedState.members.get('Alice')!;
  const bob = sharedState.members.get('Bob')!;
  const carol = sharedState.members.get('Carol')!;

  alice.deposit(kit.mint.mintPayment(bucks(10n)));
  bob.deposit(kit.mint.mintPayment(bucks(7n)));
  carol.deposit(kit.mint.mintPayment(bucks(3n)));
  bob.deposit(kit.mint.mintPayment(bucks(5n)));

  t.is(alice.getCurrentAmount().value, 10n);
  t.is(bob.getCurrentAmount().value, 12n);
  t.is(carol.getCurrentAmount().value, 3n);
});

serial('stage 4: run balance sheet and income statement', t => {
  const { db, kit } = t.context as CommunityContext;
  t.is(getTotalForAccountType(db, kit.commodityGuid, 'ASSET'), 25n);
  t.is(getTotalForAccountType(db, kit.commodityGuid, 'EQUITY'), -25n);
  t.is(getTotalForAccountType(db, kit.commodityGuid, 'EXPENSE'), 0n);
});
