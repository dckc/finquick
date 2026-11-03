/**
 * @file Types the books-review vats and tools share: what a split, an
 * account, a proposal, a lesson, and a change look like to the parties
 * that pass them around.
 */

/** An account in the book, by its full name (`Expenses:Groceries`). */
export type Account = {
  guid: string;
  name: string;
  /** GnuCash's account type: `BANK`, `CREDIT`, `EXPENSE`, ... */
  type: string;
  code: string;
  /** whether a split may be moved to it: an income or expense account that isn't a placeholder */
  category: boolean;
};

/** Where a split's money came from or went: another account in its transaction. */
export type Against = { name: string; type: string };

/** A split as a reviewer or categorizer sees it. */
export type Split = {
  split: string;
  date: string;
  description: string;
  amount: number;
  against: Against[];
};

/** Where splits of transactions with one description went before. */
export type Precedent = { account: string; count: number; last: string };

/** One change to the book, as an apply tool replays it. */
export type Change = {
  table: 'splits';
  guid: string;
  column: 'account_guid';
  from: string;
  to: string;
};

export type Status = 'proposed' | 'accepted' | 'corrected' | 'rejected';

/** A proposal, and what became of it. Accounts are guids. */
export type Proposal = {
  split: string;
  account: string;
  /** the proposer's */
  reason: string;
  /** how sure the proposer says it is, 0 to 1, if it said */
  confidence?: number;
  status: Status;
  final?: string;
  /** the reviewer's reason for the verdict, if they gave one */
  note?: string;
};

/** A proposal as a reviewer reads it: the split, with account names. */
export type Report = Split & {
  n: number;
  account: string;
  reason: string;
  confidence?: number;
  /** how often splits with this description went to the proposed account: `count` of the `of` that went to a category */
  support?: { count: number; of: number };
  status: Status;
  final?: string;
  note?: string;
};

/** A verdict on a proposal: accept it, reject it, or put the split elsewhere. */
export type Verdict = 'accept' | 'reject' | { account: string };

/** What a reviewer decided, kept across books. Accounts are names. */
export type Lesson = Split & {
  proposed: string;
  final?: string;
  status: Exclude<Status, 'proposed'>;
  reason: string;
  /** why the reviewer decided as they did, if they said */
  note?: string;
  /** the tree id of the book snapshot it was decided in */
  book: string;
};

/** An uncategorized split, with what a categorizer should know about it. */
export type Todo = Split & { precedents: Precedent[]; lessons: Lesson[] };
