/**
 * @file Types the books-review vats share: ids, and what a split, an
 * account, and a proposal look like to the parties that pass them around,
 * from the shapes of the vat that answers them where it has them: a guard
 * checks what its type says.
 */

declare const TreeIdBrand: unique symbol;
declare const WebkeyBrand: unique symbol;
declare const GuidBrand: unique symbol;

/** A git tree's id, in hex, as the git device answers it: a snapshot of the book. */
export type TreeId = string & { readonly [TreeIdBrand]: true };

/**
 * A webkey: a swiss number, 128 random bits in 32 hex digits, as the
 * entropy device answers it. Whoever presents it gets what it designates.
 */
export type Webkey = string & { readonly [WebkeyBrand]: true };

/** A GnuCash object's id: 32 hex digits. */
export type Guid = string & { readonly [GuidBrand]: true };

/** A calendar date, YYYY-MM-DD. */
export type IsoDate = `${number}-${number}-${number}`;

import type { Precedent, Split } from './boot/books.js';

/** A proposal as a reviewer reads it, typed from the shape the reviewer's guard checks it by. */
export type { Report } from './boot/reviewer.js';

/** The book's records, typed from the shapes the books vat's guard checks them by. */
export type {
  Account,
  AccountType,
  Against,
  Precedent,
  Split,
} from './boot/books.js';

/** A proposal. Accounts are guids. */
export type Proposal = {
  split: Guid;
  account: Guid;
  /** the proposer's */
  reason: string;
  /** how sure the proposer says it is, 0 to 1, if it said */
  confidence?: number;
};

/** An uncategorized split, with what a categorizer should know about it. */
export type Todo = Split & { precedents: Precedent[] };
