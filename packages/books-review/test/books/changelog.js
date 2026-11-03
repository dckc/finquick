/** @file What categorizing the fixture book (book.sql) the way the kernel test does logs: two splits out of Imbalance-USD. */
/** @type {import('../../types.ts').Change[]} */
export const CHANGELOG = [
  {
    table: 'splits',
    guid: '50000000000000000000000000000032',
    column: 'account_guid',
    from: 'a000000000000000000000000000000a',
    to: 'a0000000000000000000000000000008',
  },
  {
    table: 'splits',
    guid: '50000000000000000000000000000042',
    column: 'account_guid',
    from: 'a000000000000000000000000000000a',
    to: 'a0000000000000000000000000000009',
  },
];
