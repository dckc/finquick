/**
 * Proposals about where a book's uncategorized splits should go. A
 * categorizer gets a proposal box: it can only propose. The reviewer (this
 * vat's root) reads the proposals awaiting review, each with how often the
 * book's precedents agree. It reads the book through its view.
 */
/**
 * @import { CastedPattern, TypeFromInterfaceGuard, TypeFromPattern } from '@endo/patterns';
 * @import { BuildRootObject, MapStore, Powers, Remote } from '@vattr/toybox/src/types.ts';
 * @import { Split, Summary, View } from './books.js';
 * @import { Put, Update } from '../stores.ts';
 * @import { Guid, Proposal } from '../types.ts';
 */

/**
 * The proposal box's guard, made from the `M` a vat is given; its type is
 * inferred from it, below.
 *
 * @param {Powers['M']} M
 */
const makeBoxShapes = M => {
  /** A GnuCash guid; a lookup checks that it names something. */
  const GuidShape = /** @type {CastedPattern<Guid>} */ (M.string());
  /** How sure a proposer is: 0 to 1. */
  const ConfidenceShape = M.and(M.number(), M.gte(0), M.lte(1));
  const ProposalBoxI = M.interface('ProposalBox', {
    propose: M.callWhen(GuidShape, GuidShape, M.string())
      .optional(ConfidenceShape)
      .returns(M.number()),
    proposed: M.call().returns(M.arrayOf(GuidShape)),
  });
  return harden({ GuidShape, ProposalBoxI });
};
/** @typedef {TypeFromInterfaceGuard<ReturnType<typeof makeBoxShapes>['ProposalBoxI']>} ProposalBox what a categorizer proposes through */

/**
 * A report's own fields: a proposal's number, account by name, and
 * reason; `support`, how often splits with this description went to the
 * proposed account: `count` of the `of` that went to a category.
 *
 * TODO(account codes): a report and a precedent name their accounts, and
 * `pending` matches them by name; finquick's lm-sync and ofxies, and the
 * finSync rules, key a GnuCash account by its code. Give an account as `{ guid,
 * code, name }`, match by guid, and key what carries over by code, once
 * every category has one.
 *
 * @param {Powers['M']} M
 */
const makeReportShapes = M => {
  const required = harden({
    n: M.number(),
    account: M.string(),
    reason: M.string(),
  });
  const optional = harden({
    confidence: M.number(),
    support: harden({ count: M.number(), of: M.number() }),
  });
  return harden({
    required,
    optional,
    ReportOwnShape: M.splitRecord(required, optional),
  });
};
/**
 * A proposal as a reviewer reads it: the split, as the view described it,
 * with the report's own fields.
 *
 * @typedef {Split & TypeFromPattern<ReturnType<typeof makeReportShapes>['ReportOwnShape']>} Report
 */

/**
 * The reviewer's guard. It checks a report's own fields; the rest, the
 * split's, the view's guard checked, and a vat can't import another's
 * shapes. (Cast, since TypeFromPattern types a rest pattern as an index
 * signature.)
 *
 * @param {Powers['M']} M
 */
const makeShapes = M => {
  const { GuidShape, ...box } = makeBoxShapes(M);
  const { required, optional } = makeReportShapes(M);
  const ReportShape = /** @type {CastedPattern<Report>} */ (
    M.splitRecord(required, optional, M.record())
  );
  const ReviewerI = M.interface('Reviewer', {
    getProposalBox: M.call().returns(
      /** @type {CastedPattern<ProposalBox>} */ (M.remotable('ProposalBox')),
    ),
    accounts: M.callWhen().returns(
      M.arrayOf(harden({ guid: GuidShape, name: M.string() })),
    ),
    summary: M.callWhen().returns(
      harden({
        pending: M.number(),
        uncategorized: /** @type {CastedPattern<Summary>} */ (M.record()),
      }),
    ),
    pending: M.callWhen().returns(M.arrayOf(ReportShape)),
  });
  return harden({ GuidShape, ...box, ReviewerI });
};
/** @typedef {TypeFromInterfaceGuard<ReturnType<typeof makeShapes>['ReviewerI']>} Reviewer the vat's root */

/**
 * @typedef {object} Params
 * @property {Remote<View>} view the book's
 */

/** @type {Put} */
const put = (store, key, value) =>
  store.has(key) ? store.set(key, value) : store.init(key, value);

/** @type {Update} */
const update = (store, key, f) => {
  const value = f(store.has(key) ? store.get(key) : undefined);
  put(store, key, value);
  return value;
};

/** @satisfies {BuildRootObject<Params>} */
export const buildRootObject = ({ E, Far, M, zone }, { view }) => {
  const { ProposalBoxI, ReviewerI } = makeShapes(M);
  /** @type {MapStore<'proposal', number>} */
  const counters = zone.mapStore('counters');
  /** @type {MapStore<number, Proposal>} by number */
  const proposals = zone.mapStore('proposals');
  /** @type {MapStore<Guid, number>} split → its proposal awaiting review */
  const open = zone.mapStore('open');

  const accounts = () => E(view).accounts();

  /**
   * The proposals, oldest first, with account names and what the split is.
   *
   * @returns {Promise<Report[]>}
   */
  const report = async () => {
    const names = new Map((await accounts()).map(a => [a.guid, a.name]));
    /** @param {Guid} guid */
    const nameOf = guid => {
      const name = names.get(guid);
      // propose checked the account, and a snapshot's accounts don't change
      if (name === undefined) throw Error(`no account ${guid}`);
      return name;
    };
    const picked = [...proposals.entries()].sort(([a], [b]) => a - b);
    return harden(
      await Promise.all(
        picked.map(async ([n, p]) => {
          const { uncategorized: _, ...split } = await E(view).split(p.split);
          return { ...split, n, ...p, account: nameOf(p.account) };
        }),
      ),
    );
  };

  /** @type {ProposalBox} the guard's types, so the methods agree with what it checks */
  const boxMethods = {
    /**
     * Propose that `split` go to the income or expense account `account`;
     * the answer is the proposal's number.
     */
    async propose(split, account, reason, confidence = undefined) {
      const found = await E(view).split(split);
      if (!found.uncategorized)
        throw Error(`${JSON.stringify(split)} is not an uncategorized split`);
      const to = (await accounts()).find(a => a.guid === account);
      if (!to?.category)
        throw Error(
          `${JSON.stringify(account)} is not an income or expense account`,
        );
      if (open.has(split))
        throw Error(`split ${split} already has proposal ${open.get(split)}`);
      const n = update(counters, 'proposal', (n = 0) => n + 1);
      proposals.init(
        n,
        harden({
          split: found.split,
          account: to.guid,
          reason,
          ...(confidence === undefined ? {} : { confidence }),
        }),
      );
      open.init(found.split, n);
      return n;
    },
    /** The splits with proposals awaiting review. */
    proposed() {
      return harden(open.keys());
    },
  };
  const makeProposalBox = zone.exoClass(
    'ProposalBox',
    ProposalBoxI,
    () => ({}),
    boxMethods,
  );
  const box = zone.makeOnce('box', () => makeProposalBox());

  /** @type {Reviewer} the guard's types, so the methods agree with what it checks */
  const methods = {
    getProposalBox: () => box,
    /** The income and expense accounts a split can go to. */
    async accounts() {
      return harden(
        (await accounts())
          .filter(a => a.category)
          .map(({ guid, name }) => ({ guid, name })),
      );
    },
    /** Where the review stands: proposals awaiting review, and the book's uncategorized splits. */
    async summary() {
      return harden({
        pending: open.getSize(),
        uncategorized: await E(view).summary(),
      });
    },
    /**
     * The proposals awaiting review, oldest first, each with its support:
     * how often splits with its description went to the proposed account.
     */
    async pending() {
      const reports = await report();
      return harden(
        await Promise.all(
          reports.map(async r => {
            const precedents = await E(view).precedents(r.description);
            const of = precedents.reduce((sum, p) => sum + p.count, 0);
            const count =
              precedents.find(p => p.account === r.account)?.count ?? 0;
            return { ...r, support: { count, of } };
          }),
        ),
      );
    },
  };
  const reviewer = zone.exo('Reviewer', ReviewerI, methods);

  // A vat's root is a Far, as a swingset vat's must be, not a durable
  // object: it calls the reviewer, through its guard.
  return Far('reviewer', {
    getProposalBox: () => reviewer.getProposalBox(),
    accounts: () => reviewer.accounts(),
    summary: () => reviewer.summary(),
    pending: () => reviewer.pending(),
  });
};
