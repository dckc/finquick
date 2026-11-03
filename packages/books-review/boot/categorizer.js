/**
 * What an AI holds to categorize a book: it reads the book through a view,
 * reads the lessons reviewers taught (across books), and proposes through a
 * reviewer's proposal box. It can't move a split, decide a proposal, or
 * record a lesson.
 *
 * `categorize(limit, model, name)` asks a model, through the WebApp it's
 * handed for that call, to propose accounts for up to `limit` splits.
 */
/**
 * @import { BuildRootObject, Remote } from '@vattr/toybox/types.ts';
 * @import { Account, Lesson, Precedent, Split, Todo } from '../types.ts';
 */

/** How many precedents and lessons come with each uncategorized split. */
const CONTEXT = 5;

const SYSTEM = `You categorize transactions in a GnuCash book. For each split
you are given, call propose once with the split's id, the full name of the
income or expense account it belongs in (from the accounts listed), and a
short reason. Precedents say where transactions with the same description
went before; lessons say what a person decided about such proposals. Skip a
split if you have no good guess.`;

/** The propose tool, as an OpenAI-style chat completions API takes it. */
const PROPOSE = harden({
  type: 'function',
  function: {
    name: 'propose',
    description:
      'Propose an income or expense account for an uncategorized split.',
    parameters: {
      type: 'object',
      properties: {
        split: { type: 'string', description: "the split's id" },
        account: {
          type: 'string',
          description: 'the full name of an account from the list',
        },
        reason: { type: 'string' },
      },
      required: ['split', 'account', 'reason'],
    },
  },
});

/**
 * The tool calls in a chat completion's first choice, as name and parsed
 * arguments; arguments that aren't JSON come back as an error.
 *
 * @param {any} completion
 * @returns {{ name: string, args?: Record<string, unknown>, error?: string }[]}
 */
export const toolCalls = completion =>
  (completion?.choices?.[0]?.message?.tool_calls ?? []).map(
    (/** @type {any} */ call) => {
      const name = String(call?.function?.name);
      try {
        return { name, args: JSON.parse(call?.function?.arguments ?? '{}') };
      } catch {
        return { name, error: 'arguments are not JSON' };
      }
    },
  );

/**
 * What the model sees of the work: the accounts, and each split with its
 * precedents and lessons, without guids it doesn't need.
 *
 * @param {Account[]} categories
 * @param {Todo[]} todo
 */
export const prompt = (categories, todo) =>
  JSON.stringify({
    accounts: categories.map(a => a.name),
    splits: todo.map(t => ({
      id: t.split,
      date: t.date,
      description: t.description,
      amount: t.amount,
      from: t.against.map(a => `${a.name} (${a.type})`),
      precedents: t.precedents,
      lessons: t.lessons.map(l => ({
        proposed: l.proposed,
        final: l.final,
        status: l.status,
        ...(l.note ? { why: l.note } : {}),
      })),
    })),
  });

/**
 * @typedef {object} Params
 * @property {Remote} view the book's
 * @property {Remote} box the reviewer's proposal box
 * @property {Remote} lessons the lessons' reader
 */

/** @type {BuildRootObject<Params>} */
export const buildRootObject = ({ E, Far }, { view, box, lessons }) => {
  /** @returns {Promise<Account[]>} */
  const categories = async () =>
    /** @type {Account[]} */ (await E(view).accounts()).filter(a => a.category);

  /**
   * The first `limit` uncategorized splits no proposal awaits and none was
   * rejected for in this book, with their context. A rejected split waits
   * for a person: it isn't proposed again until someone categorizes it or
   * takes it up in a later snapshot, where its lesson comes along.
   *
   * @param {number} [limit]
   * @returns {Promise<Todo[]>}
   */
  const uncategorized = async (limit = Infinity) => {
    /** @type {[Split[], string[], string[]]} */
    const [splits, proposed, rejected] = await Promise.all([
      E(view).uncategorized(),
      E(box).proposed(),
      E(box).rejected(),
    ]);
    const skip = new Set([...proposed, ...rejected]);
    return harden(
      await Promise.all(
        // context only for those asked for: precedents cost a query each
        splits
          .filter(s => !skip.has(s.split))
          .slice(0, limit)
          .map(async s => {
            /** @type {[Precedent[], Lesson[]]} */
            const [precedents, taught] = await Promise.all([
              E(view).precedents(s.description),
              E(lessons).lessons(s.description),
            ]);
            return {
              ...s,
              precedents: precedents.slice(0, CONTEXT),
              lessons: taught.slice(0, CONTEXT),
            };
          }),
      ),
    );
  };

  return Far('categorizer', {
    /** The income and expense accounts a split can go to. */
    async accounts() {
      return harden(
        (await categories()).map(({ guid, name }) => ({ guid, name })),
      );
    },
    /**
     * The uncategorized splits no proposal awaits review for, and none was
     * rejected for, oldest first, each with context: `precedents`, where
     * splits with the same description went before in this book, and
     * `lessons`, what reviewers decided about that description.
     *
     * @param {number} [limit]
     */
    uncategorized: limit => uncategorized(limit),
    /** @param {string} split @param {string} account @param {string} reason */
    propose: (split, account, reason) => E(box).propose(split, account, reason),
    /** @param {string} description */
    precedents: description => E(view).precedents(description),
    /** What reviewers decided, newest first; about `description` only, if given. @param {string} [description] */
    history: description => E(lessons).lessons(description),
    /**
     * Ask the model behind `model`, an OpenAI-style API's WebApp (its
     * `/v1/`), to propose accounts for up to `limit` of the splits no
     * proposal awaits, in one chat completion. Each `propose` it calls goes
     * to the proposal box; the answer says which made proposals and which
     * were refused.
     *
     * TODO: send refusals back to the model as tool results, for another
     * try; size batches to the model's context; keep a run's progress
     * durable, so a restart resumes it; retry or back off on errors.
     *
     * @param {number} limit
     * @param {Remote} model
     * @param {string} name the model's name, as the API knows it
     */
    async categorize(limit, model, name) {
      const todo = await uncategorized(limit);
      if (!todo.length) return harden({ proposed: [], refused: [] });
      const accounts = await categories();
      const reply = await E(E(model).pathjoin('chat/completions')).post(
        JSON.stringify({
          model: name,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: prompt(accounts, todo) },
          ],
          tools: [PROPOSE],
        }),
      );
      const byName = new Map(accounts.map(a => [a.name, a.guid]));
      /** @type {{ split: string, n: number }[]} */
      const proposed = [];
      /** @type {{ split?: unknown, error: string }[]} */
      const refused = [];
      for (const { name: tool, args, error } of toolCalls(JSON.parse(reply))) {
        if (tool !== 'propose' || !args) {
          refused.push({ error: error ?? `no tool ${tool}` });
          continue;
        }
        const { split, account, reason } = args;
        try {
          if (typeof split !== 'string' || typeof account !== 'string')
            throw Error('split and account are strings');
          const guid = byName.get(account) ?? account;
          const n = await E(box).propose(split, guid, String(reason ?? ''));
          proposed.push({ split, n });
        } catch (e) {
          refused.push({ split, error: /** @type {Error} */ (e).message });
        }
      }
      return harden({ proposed, refused });
    },
  });
};
