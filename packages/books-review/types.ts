/**
 * @file Types the books-review vats share: ids, and what a split and an
 * account look like to the parties that pass them around, from the
 * shapes of the vat that answers them: a guard checks what its type says.
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

/** The book's records, typed from the shapes the books vat's guard checks them by. */
export type {
  Account,
  AccountType,
  Against,
  Precedent,
  Split,
} from './boot/books.js';
