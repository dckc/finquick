/**
 * @file Snapshot-based design doc for ERTP->GnuCash mapping.
 */

import test from 'ava';
import type { ExecutionContext } from 'ava';
import type { TestFn } from 'ava';
import Database from 'better-sqlite3';
import type { Brand, NatAmount } from '../src/ertp-types.js';
import {
  createIssuerKit,
  initGnuCashSchema,
  makeChartFacet,
  wrapBetterSqlite3Database,
} from '../src/index.js';
import type { Guid } from '../src/types.js';
import { mockMakeGuid } from '../src/guids.js';
import { makeTestClock } from './helpers/clock.js';

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
  purse: ReturnType<
    ReturnType<typeof createIssuerKit>['issuer']['makeEmptyPurse']
  >;
};

let closeDb: (() => void) | undefined;

const withDesignContext = (t: ExecutionContext<DesignContext>) => {
  const { freeze } = Object;
  const rawDb = new Database(':memory:');
  const db = wrapBetterSqlite3Database(rawDb);
  initGnuCashSchema(db);

  const makeGuid = mockMakeGuid();
  const nowMs = makeTestClock(Date.UTC(2026, 0, 24, 0, 0), 1);
  const commodity = freeze({ namespace: 'COMMODITY', mnemonic: 'BUCKS' });
  const kit = createIssuerKit(freeze({ db, commodity, makeGuid, nowMs }));
  const brand = kit.brand as Brand<'nat'>;
  const bucks = (value: bigint): NatAmount => freeze({ brand, value });

  const purse = kit.issuer.makeEmptyPurse();
  const payment = kit.mint.mintPayment(bucks(5n));
  purse.deposit(payment);

  closeDb = () => rawDb.close();
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
    >(
      [
        'SELECT guid, num, post_date, enter_date',
        'FROM transactions',
        'ORDER BY guid',
      ].join(' '),
    )
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
    >(
      [
        'SELECT guid, tx_guid, account_guid, value_num, value_denom, reconcile_state',
        'FROM splits',
        'ORDER BY guid',
      ].join(' '),
    )
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
    [
      'GnuCash is an accounting program; a bit like Quicken but based more on traditional double-entry accounting.',
      'ERTP is a flexible Electronic Rights protocol.',
      'ERTP is flexible enough that we can implement it on top of a GnuCash database.',
      '',
      'We start with the smallest ERTP action that writes to the database: mint 5 BUCKS and deposit them into a purse.',
      'This creates one transaction and two splits, moving value from the mint holding account into the purse.',
    ].join('\n'),
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
    [
      'Splits show the value move: one positive into the purse account and one negative out of the mint holding account.',
      '',
      'Context: before the deposit we already created issuer and purse records:',
      '  const { issuer } = makeIssuerKit("BUCKS");',
      '  const purse = issuer.makeEmptyPurse();',
      '',
      'Those actions touch other tables too:',
      '- createIssuerKit inserts a commodity row (BUCKS) and creates mint recovery/holding accounts.',
      '- makeEmptyPurse inserts an account row for the new purse (later named via ChartFacet).',
    ].join('\n'),
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
      [
        'SELECT guid, name, parent_guid, account_type, placeholder',
        'FROM accounts',
        'WHERE commodity_guid = ?',
        'ORDER BY guid',
      ].join(' '),
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
    [
      'ERTP mints are separate from human-facing names.',
      'Anyone can create an ERTP `Mint`; if someone called it USD when it was not, that would be trouble.',
      'Until a chart names accounts, the ledger is correct but opaque to humans.',
    ].join('\n'),
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
    getPurseGuid: kit.purses.getGuid,
  });
  chart.placePurse({
    purse,
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
      [
        'SELECT guid, name, parent_guid, account_type, placeholder',
        'FROM accounts',
        'WHERE commodity_guid = ?',
        'ORDER BY guid',
      ].join(' '),
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
    [
      'makeIssuerKit("BUCKS") was a simplification.',
      'The actual setup wires a chart facet so we can name accounts:',
      '  const kit = createIssuerKit({ db, ... });',
      '  const chart = makeChartFacet({ db, getPurseGuid: kit.purses.getGuid, ... });',
      '  chart.placePurse({ purse, name: "Alice", parentGuid: rootGuid, accountType: "STOCK" });',
      '',
      'Placing the purse under a parent account gives it a human name and a path (e.g., Org1:Alice).',
    ].join('\n'),
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
    >(
      [
        'SELECT guid, currency_guid, num, post_date, enter_date, description',
        'FROM transactions',
        'ORDER BY guid',
      ].join(' '),
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
      [
        'SELECT splits.guid, splits.tx_guid, splits.account_guid, accounts.name AS account_name,',
        'splits.value_num, splits.value_denom, splits.reconcile_state',
        'FROM splits JOIN accounts ON splits.account_guid = accounts.guid',
        'ORDER BY splits.guid',
      ].join(' '),
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
    [
      'Withdraw removes value from the purse by creating a new hold transaction, in addition to the earlier mint/deposit transaction.',
      'The split table shows the line items for that new transaction.',
      'The hold keeps value in a dedicated holding account until deposit or cancel.',
    ].join('\n'),
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

test.todo('Multi-commodity swaps: show ledger rows for two brands');
