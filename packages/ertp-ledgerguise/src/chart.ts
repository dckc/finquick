import { defaultZone } from './jessie-tools.js';
import type { Zone } from './jessie-tools.js';
import type { SqlDatabase } from './sql-db.js';
import type { ChartFacet, Guid } from './types.js';
import { requireAccountCommodity } from './db-helpers.js';

/**
 * @file Chart facet for placing purse accounts into a community chart of accounts.
 */

/**
 * Create a chart facet that can place purse accounts into the account tree.
 */
export const makeChartFacet = ({
  db,
  commodityGuid,
  getGuidFromSealed,
  zone = defaultZone,
}: {
  db: SqlDatabase;
  commodityGuid: Guid;
  getGuidFromSealed: (sealedPurse: unknown) => Guid;
  zone?: Zone;
}): ChartFacet => {
  const { exo } = zone;
  const updateAccount = ({
    accountGuid,
    name,
    parentGuid,
    accountType,
    placeholder,
    code,
  }: {
    accountGuid: Guid;
    name: string;
    parentGuid: Guid | null;
    accountType: string;
    placeholder: boolean;
    code: string | null;
  }) => {
    requireAccountCommodity({ db, accountGuid, commodityGuid });
    if (parentGuid !== null) {
      const row = db
        .prepare<[string], { guid: string }>('SELECT guid FROM accounts WHERE guid = ?')
        .get(parentGuid);
      if (!row) {
        throw new Error('parent account not found');
      }
    }
    db.prepare(`
      UPDATE accounts SET name = ?, account_type = ?, parent_guid = ?, placeholder = ?, code = ?
      WHERE guid = ?
    `).run(name, accountType, parentGuid, placeholder ? 1 : 0, code, accountGuid);
  };

  return exo('ChartFacet', {
    placePurse: ({
      sealedPurse,
      name,
      parentGuid = null,
      accountType = 'ASSET',
      placeholder = false,
      code = null,
    }: {
      sealedPurse: unknown;
      name: string;
      parentGuid?: Guid | null;
      accountType?: string;
      placeholder?: boolean;
      code?: string | null;
    }) => {
      const purseGuid = getGuidFromSealed(sealedPurse);
      updateAccount({
        accountGuid: purseGuid,
        name,
        parentGuid,
        accountType,
        placeholder,
        code,
      });
    },
    placeAccount: ({
      accountGuid,
      name,
      parentGuid = null,
      accountType = 'ASSET',
      placeholder = false,
      code = null,
    }: {
      accountGuid: Guid;
      name: string;
      parentGuid?: Guid | null;
      accountType?: string;
      placeholder?: boolean;
      code?: string | null;
    }) => {
      updateAccount({
        accountGuid,
        name,
        parentGuid,
        accountType,
        placeholder,
        code,
      });
    },
  });
};
