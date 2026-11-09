/**
 * @file Types the books-review vats and tools share: ids, and what a
 * split, an account, a proposal, a lesson, and a change look like to the
 * parties that pass them around, from the shapes of the vat that answers
 * them where it has them: a guard checks what its type says.
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
import type { Lesson } from './boot/lessons.js';
import type { Status } from './boot/reviewer.js';

/** The book's records, typed from the shapes the books vat's guard checks them by. */
export type {
  Account,
  AccountType,
  Against,
  Change,
  Precedent,
  Split,
} from './boot/books.js';

/** A proposal as a reviewer reads it, a verdict on it, and where it stands, typed from the shapes the reviewer's guard checks them by. */
export type { Report, Status, Verdict } from './boot/reviewer.js';

/** What a reviewer decided, kept across books, typed from the shape the lessons vat's guard checks it by. */
export type { Lesson } from './boot/lessons.js';

/**
 * `A`, where `A` and `B` are the same type, and a type error otherwise:
 * for a copy of a shape that a vat can't import, and that must not drift
 * from the one it copies. (Optional fields aside: TypeScript takes
 * `{ a }` and `{ a, b? }` for each other.)
 */
export type Same<A extends B, B extends C, C = A> = A;

/** A proposal, and what became of it. Accounts are guids. */
export type Proposal = {
  split: Guid;
  account: Guid;
  /** the proposer's */
  reason: string;
  /** how sure the proposer says it is, 0 to 1, if it said */
  confidence?: number;
  status: Status;
  final?: Guid;
  /** the reviewer's reason for the verdict, if they gave one */
  note?: string;
};

/** An uncategorized split, with what a categorizer should know about it. */
export type Todo = Split & { precedents: Precedent[]; lessons: Lesson[] };

/** A visit from a Google Maps Timeline export, as the whereabouts vat's guard checks it. */
export type { Visit } from './boot/whereabouts.js';
