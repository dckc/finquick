/**
 * @file GnuCash table types and test helpers for snapshot formatting.
 */

import type { AccountRow, SplitRow } from '../src/gnucash-schema.js';

// Named subsets for common query patterns
export type AccountPath = Pick<AccountRow, 'guid' | 'name' | 'parent_guid'>;
export type AccountView = Pick<
  AccountRow,
  'guid' | 'name' | 'parent_guid' | 'account_type' | 'placeholder'
>;
export type AccountWithCode = Pick<
  AccountRow,
  'guid' | 'name' | 'parent_guid' | 'placeholder' | 'code'
>;
export type SplitEntry = Pick<
  SplitRow,
  | 'guid'
  | 'tx_guid'
  | 'account_guid'
  | 'value_num'
  | 'value_denom'
  | 'reconcile_state'
>;

// #region Column lists for snapshots

export const accountViewCols = [
  'guid',
  'name',
  'parent_guid',
  'account_type',
  'placeholder',
];

export const splitEntryCols = [
  'guid',
  'tx_guid',
  'account_guid',
  'value_num',
  'value_denom',
  'reconcile_state',
];

// #endregion

// #region Row mappers

const GUID_KEYS = [
  'guid',
  'tx_guid',
  'account_guid',
  'currency_guid',
  'parent_guid',
  'commodity_guid',
];

const DATE_KEYS = ['post_date', 'enter_date', 'reconcile_date'];

/** Truncate a GUID to its last 12 characters for readable snapshots. */
export const shortGuid = (guid: string) => guid.slice(-12);

/**
 * Create a row mapper that truncates GUID fields to their last 12 characters.
 * @param keys - GUID field names to truncate (defaults to common GnuCash GUID columns)
 */
export const shortGuids =
  <T extends object>(keys: string[] = GUID_KEYS) =>
  (row: T): T => {
    const r = { ...row } as Record<string, unknown>;
    for (const k of keys) {
      if (k in r && typeof r[k] === 'string') r[k] = shortGuid(r[k] as string);
    }
    return r as T;
  };

/**
 * Create a row mapper that truncates date fields to just the date portion.
 * @param keys - Date field names to truncate (defaults to common GnuCash date columns)
 */
export const shortDates =
  <T extends object>(keys: string[] = DATE_KEYS) =>
  (row: T): T => {
    const r = { ...row } as Record<string, unknown>;
    for (const k of keys) {
      if (k in r && typeof r[k] === 'string')
        r[k] = (r[k] as string).split(' ')[0];
    }
    return r as T;
  };

// #endregion

// #region Snapshot formatting

/**
 * Format rows as pipe-delimited strings for readable snapshots.
 * Numeric columns are right-justified; others are left-justified.
 */
export const toRowStrings = (
  rows: Record<string, unknown>[],
  columns: string[],
): string[] => {
  if (rows.length === 0) return [columns.join(' | ')];
  const widths = columns.map(column =>
    Math.max(
      column.length,
      ...rows.map(row => String(row[column] ?? '').length),
    ),
  );
  // Right-justify columns where all values are numeric
  const isNumeric = columns.map(column =>
    rows.every(row => /^-?\d+$/.test(String(row[column] ?? ''))),
  );
  const format = (row: Record<string, unknown>, isHeader = false) =>
    columns
      .map((column, index) => {
        const val = String(row[column] ?? '');
        return isNumeric[index] && !isHeader
          ? val.padStart(widths[index])
          : val.padEnd(widths[index]);
      })
      .join(' | ');
  const header = Object.fromEntries(columns.map(column => [column, column]));
  return [format(header, true), ...rows.map(row => format(row))];
};

// #endregion
