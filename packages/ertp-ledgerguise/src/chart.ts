import { freezeProps } from './jessie-tools';
import type { ChartFacet, Guid } from './types';
import { requireAccountCommodity } from './db-helpers';

/**
 * @file Chart facet for placing purse accounts into a community chart of accounts.
 */

/**
 * Create a chart facet that can place purse accounts into the account tree.
 */
export const makeChartFacet = ({
  db,
  commodityGuid,
  getPurseGuid,
}: {
  db: import('better-sqlite3').Database;
  commodityGuid: Guid;
  getPurseGuid: (purse: unknown) => Guid;
}): ChartFacet =>
  freezeProps({
    placePurse: ({
      purse,
      name,
      parentGuid = null,
      accountType = 'ASSET',
    }: {
      purse: unknown;
      name: string;
      parentGuid?: Guid | null;
      accountType?: string;
    }) => {
      const purseGuid = getPurseGuid(purse);
      requireAccountCommodity({ db, accountGuid: purseGuid, commodityGuid });
      if (parentGuid !== null) {
        const row = db
          .prepare<[string], { guid: string }>('SELECT guid FROM accounts WHERE guid = ?')
          .get(parentGuid);
        if (!row) {
          throw new Error('parent account not found');
        }
      }
      db.prepare(
        [
          'UPDATE accounts SET name = ?, account_type = ?, parent_guid = ?',
          'WHERE guid = ?',
        ].join(' '),
      ).run(name, accountType, parentGuid, purseGuid);
    },
  });
