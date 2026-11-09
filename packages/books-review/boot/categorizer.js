/**
 * What an AI holds to categorize a book: it reads the book through a view,
 * and proposes through a reviewer's proposal box, and that's all.
 *
 * `categorize(limit, model, name)` asks a model, through the WebApp it's
 * handed for that call, to propose accounts for up to `limit` splits.
 */
/**
 * @import { BuildRootObject, Remote } from '@vattr/toybox/src/types.ts';
 * @import { WebApp } from '../devices.ts';
 * @import { View } from './books.js';
 * @import { ProposalBox } from './reviewer.js';
 * @import { Account, Guid, Todo } from '../types.ts';
 */

/** How many precedents come with each uncategorized split. */
const CONTEXT = 5;

const SYSTEM = `You categorize transactions in a GnuCash book. For each split
you are given, call propose once with the split's id, the full name of the
income or expense account it belongs in (from the accounts listed), a
short reason, and how confident you are, from 0 to 1. Precedents say where transactions with the same description
went before. Skip a split if you have no good guess.`;

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
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'how sure you are, from 0 to 1',
        },
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
 * precedents, without guids it doesn't need.
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
    })),
  });

/**
 * @typedef {object} Params
 * @property {Remote<View>} view the book's
 * @property {Remote<ProposalBox>} box the reviewer's proposal box
 */

/** @satisfies {BuildRootObject<Params>} */
export const buildRootObject = ({ E, Far }, { view, box }) => {
  const categories = async () =>
    (await E(view).accounts()).filter(a => a.category);

  /**
   * The first `limit` uncategorized splits no proposal awaits, with their
   * context.
   *
   * @param {number} [limit]
   * @returns {Promise<Todo[]>}
   */
  const uncategorized = async (limit = Infinity) => {
    const [splits, proposed] = await Promise.all([
      E(view).uncategorized(),
      E(box).proposed(),
    ]);
    const skip = new Set(proposed);
    return harden(
      await Promise.all(
        // context only for those asked for: precedents cost a query each
        splits
          .filter(s => !skip.has(s.split))
          .slice(0, limit)
          .map(async s => {
            const precedents = await E(view).precedents(s.description);
            return { ...s, precedents: precedents.slice(0, CONTEXT) };
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
     * The uncategorized splits no proposal awaits review for, oldest first,
     * each with context: `precedents`, where splits with the same
     * description went before in this book.
     *
     * @param {number} [limit]
     */
    uncategorized: limit => uncategorized(limit),
    /** @param {Guid} split @param {Guid} account @param {string} reason @param {number} [confidence] */
    propose: (split, account, reason, confidence) =>
      E(box).propose(
        split,
        account,
        reason,
        ...(confidence === undefined ? [] : [confidence]),
      ),
    /** @param {string} description */
    precedents: description => E(view).precedents(description),
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
     * @param {Remote<WebApp>} model
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
      /** @type {{ split: Guid, n: number }[]} */
      const proposed = [];
      /** @type {{ split?: unknown, error: string }[]} */
      const refused = [];
      for (const { name: tool, args, error } of toolCalls(JSON.parse(reply))) {
        if (tool !== 'propose' || !args) {
          refused.push({ error: error ?? `no tool ${tool}` });
          continue;
        }
        const { split, account, reason, confidence } = args;
        try {
          // the model's strings become guids by lookup: of the splits it
          // was asked about, and the accounts it was shown
          const asked = todo.find(t => t.split === split);
          if (!asked)
            throw Error(`${JSON.stringify(split)} is not a split asked about`);
          const guid =
            typeof account === 'string' ? byName.get(account) : undefined;
          if (!guid)
            throw Error(
              `${JSON.stringify(account)} is not an income or expense account`,
            );
          const n = await E(box).propose(
            asked.split,
            guid,
            String(reason ?? ''),
            ...(typeof confidence === 'number' ? [confidence] : []),
          );
          proposed.push({ split: asked.split, n });
        } catch (e) {
          refused.push({ split, error: /** @type {Error} */ (e).message });
        }
      }
      return harden({ proposed, refused });
    },
  });
};
/** @typedef {ReturnType<typeof buildRootObject>} Categorizer the vat's root */
