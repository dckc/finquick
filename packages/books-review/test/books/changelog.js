/** @file What categorizing the fixture book (book.sql) the way the kernel test does logs: two splits out of Imbalance-USD. */
/** @import { Change, Guid } from '../../types.ts'; */

/** @param {string} s */
const guid = s => /** @type {Guid} */ (s);

/** @type {Change[]} */
export const CHANGELOG = [
  {
    table: 'splits',
    guid: guid('50000000000000000000000000000032'),
    column: 'account_guid',
    from: guid('a000000000000000000000000000000a'),
    to: guid('a0000000000000000000000000000008'),
  },
  {
    table: 'splits',
    guid: guid('50000000000000000000000000000042'),
    column: 'account_guid',
    from: guid('a000000000000000000000000000000a'),
    to: guid('a0000000000000000000000000000009'),
  },
];
