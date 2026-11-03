/**
 * Proposals about where a book's uncategorized splits should go, and the
 * verdicts on them. A categorizer gets a proposal box: it can only propose.
 * The reviewer (this vat's root) accepts, rejects, or corrects each; only
 * then does it ask the book's mover to move the split. It reads the book
 * through its view, and records each verdict as a lesson, kept across books
 * (see lessons.js).
 */
/**
 * @import { BuildRootObject, MapStore, Remote } from '@vattr/toybox/types.ts';
 * @import { Account, Proposal, Report, Split, Status, Verdict } from '../types.ts';
 */

/**
 * @typedef {object} Params
 * @property {Remote} view the book's
 * @property {Remote} mover the book's
 * @property {Remote} lessons the lessons' recorder
 * @property {string} book the tree id of the book's snapshot
 */

/** @type {BuildRootObject<Params>} */
export const buildRootObject = (
  { E, Far, M, zone },
  { view, mover, lessons, book },
) => {
  /** @type {MapStore<string, number>} */
  const counters = zone.mapStore('counters');
  /** @type {MapStore<number, Proposal>} by number */
  const proposals = zone.mapStore('proposals');
  /** @type {MapStore<string, number>} split guid → its proposal awaiting review */
  const open = zone.mapStore('open');

  /** @returns {Promise<Account[]>} */
  const accounts = () => E(view).accounts();

  /**
   * Proposals whose status is `wanted` (just number `only`, if given), with
   * account names and what the split is.
   *
   * @param {(status: Status) => boolean} wanted
   * @param {number} [only]
   * @returns {Promise<Report[]>}
   */
  const report = async (wanted, only = undefined) => {
    const names = new Map((await accounts()).map(a => [a.guid, a.name]));
    const picked = proposals
      .entries()
      .sort(([a], [b]) => a - b)
      .filter(
        ([n, p]) => wanted(p.status) && (only === undefined || n === only),
      );
    return harden(
      await Promise.all(
        picked.map(async ([n, p]) => {
          /** @type {Split & { uncategorized: boolean }} */
          const { uncategorized: _, ...split } = await E(view).split(p.split);
          return {
            ...split,
            n,
            ...p,
            account: names.get(p.account) ?? p.account,
            ...(p.final ? { final: names.get(p.final) ?? p.final } : {}),
          };
        }),
      ),
    );
  };

  const makeProposalBox = zone.exoClass(
    'ProposalBox',
    M.interface('ProposalBox', {
      propose: M.call(M.string(), M.string(), M.string()).returns(M.promise()),
      proposed: M.call().returns(M.arrayOf(M.string())),
    }),
    () => ({}),
    {
      /**
       * Propose that `split` go to the income or expense account `account`;
       * the answer is the proposal's number.
       *
       * @param {string} split
       * @param {string} account
       * @param {string} reason
       */
      async propose(split, account, reason) {
        if (!(await E(view).split(split)).uncategorized)
          throw Error(`${JSON.stringify(split)} is not an uncategorized split`);
        const found = (await accounts()).find(a => a.guid === account);
        if (!found?.category)
          throw Error(
            `${JSON.stringify(account)} is not an income or expense account`,
          );
        if (open.has(split))
          throw Error(`split ${split} already has proposal ${open.get(split)}`);
        const n = counters.has('proposal') ? counters.get('proposal') + 1 : 1;
        if (counters.has('proposal')) counters.set('proposal', n);
        else counters.init('proposal', n);
        proposals.init(
          n,
          harden({ split, account, reason, status: 'proposed' }),
        );
        open.init(split, n);
        return n;
      },
      /** The splits with proposals awaiting review. */
      proposed() {
        return harden(open.keys());
      },
    },
  );
  const box = zone.makeOnce('box', () => makeProposalBox());

  return Far('reviewer', {
    getProposalBox: () => box,
    /** The income and expense accounts a split can go to. */
    async accounts() {
      return harden(
        (await accounts())
          .filter(a => a.category)
          .map(({ guid, name }) => ({ guid, name })),
      );
    },
    /** The proposals awaiting review, oldest first. */
    pending: () => report(status => status === 'proposed'),
    /**
     * Decide proposal `n`: `"accept"`, `"reject"`, or `{ account }` to put
     * the split in another income or expense account instead. Accepting
     * or correcting asks the book's mover to move the split. `note` says
     * why; it's kept with the lesson, for later categorizers.
     *
     * @param {number} n
     * @param {Verdict} verdict
     * @param {string} [note]
     */
    async review(n, verdict, note = undefined) {
      if (note !== undefined && typeof note !== 'string')
        throw Error('a note is a string');
      const why = note?.trim() ? { note: note.trim() } : {};
      if (!proposals.has(n)) throw Error(`no proposal ${n}`);
      const p = proposals.get(n);
      if (p.status !== 'proposed')
        throw Error(`proposal ${n} is already ${p.status}`);
      const corrected =
        typeof verdict === 'object' &&
        verdict !== null &&
        typeof verdict.account === 'string';
      if (verdict !== 'accept' && verdict !== 'reject' && !corrected)
        throw Error('a verdict is "accept", "reject", or { account }');
      /** @type {Proposal} */
      let decided;
      if (verdict === 'reject') {
        decided = harden({ ...p, ...why, status: 'rejected' });
      } else {
        const to = typeof verdict === 'object' ? verdict.account : p.account;
        // the mover checks the split and account again; a refusal leaves the proposal open
        await E(mover).move(p.split, to);
        decided = harden({
          ...p,
          ...why,
          status: corrected ? 'corrected' : 'accepted',
          final: to,
        });
      }
      proposals.set(n, decided);
      open.delete(p.split);
      const [lesson] = await report(status => status !== 'proposed', n);
      const { n: _, split: __, account: proposed, ...rest } = lesson;
      await E(lessons).record(harden({ ...rest, proposed, book }));
    },
    /** Every decided proposal, oldest first. */
    decided: () => report(status => status !== 'proposed'),
    /** The book's changelog. */
    changelog: () => E(mover).changelog(),
  });
};
