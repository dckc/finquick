// @ts-check
const IMBALANCE_USD = '9001';

const { freeze, entries } = Object;

const maybe = (x, f) => (x ? [f(x)] : []);
const by = (prop, d = 1) => (a, b) =>
  // eslint-disable-next-line no-nested-ternary
  a[prop] === b[prop] ? 0 : d * (a[prop] < b[prop] ? -1 : 1);

const short = dt => dt.toISOString().slice(0, 10);

const fail = why => {
  throw Error(why);
};

/**
 * @param {Object} io
 * @param {(sel: string) => Element} io.$
 * @param {(tag: string) => Element} io.createElement
 * @param {(tag: string) => Text} io.createTextNode
 */
const makeFields = ({ createElement, createTextNode, $ }) => {
  /**
   *
   * @param {string} tag
   * @param {Record<string, string>} attrs
   * @param {(Element|string)[]} children
   */
  const elt = (tag, attrs = {}, children = []) => {
    const it = createElement(tag);
    entries(attrs).forEach(([name, value]) => it.setAttribute(name, value));
    children.forEach(ch => {
      if (typeof ch === 'string') {
        it.appendChild(createTextNode(ch));
      } else {
        it.appendChild(ch);
      }
    });
    return it;
  };

  /** @param {string} sel */
  const theInput = sel => {
    const it = $(sel);
    // eslint-disable-next-line no-undef
    if (!(it instanceof HTMLInputElement)) throw TypeError();
    return it;
  };
  /** @param {string} sel */
  const theSelect = sel => {
    const it = $(sel);
    // eslint-disable-next-line no-undef
    if (!(it instanceof HTMLSelectElement)) throw TypeError();
    return it;
  };
  const control = freeze({
    user: $('#budget_name'),
    accountsUpdate: $('#updateSetup'),
    endPoint: $('#endpoint'),
    apiKey: theInput('#apiKey'),
    transationsUpdate: $('#updateTransactions'),
    txFrom: theInput('input[name="txFrom"]'),
    txTo: theInput('input[name="txTo"]'),
    accounts: theSelect('select[name="account"]'),
    categories: theSelect('select[name="category"]'),
    status: theSelect('select[name="statusLM"]'),
    txSplits: $('#txSplits'),
    transationsPatch: $('#patchTransactions'),
  });

  /**
   * @param {HTMLSelectElement} ctrl
   * @param {(r: Record<string, any>) => string} [getName]
   * @param {Element} [btn]
   */
  const selectField = (ctrl, getName = r => r.name, btn = undefined) =>
    freeze({
      onClick: h => {
        if (!btn) throw TypeError();
        btn.addEventListener('click', h);
      },
      set: val => {
        ctrl.replaceChildren();
        val
          // .filter(({ status }) => status !== 'inactive')
          .forEach(r =>
            ctrl.appendChild(elt('option', { value: r.id }, [getName(r)])),
          );
      },
      getCurrent: () => ctrl.value,
      getMulti: () =>
        [...ctrl.querySelectorAll('option')]
          .filter(o => o.selected)
          .map(o => o.value),
    });

  const fields = {
    endPoint: freeze({
      get: () => control.endPoint.getAttribute('href') || fail('missing href'),
    }),
    apiKey: freeze({
      set: val => (control.apiKey.value = val),
      onBlur: h => control.apiKey.addEventListener('blur', h),
    }),
    user: freeze({
      set: user => {
        control.user.textContent = user.budget_name;
        control.user.setAttribute('title', JSON.stringify(user));
      },
    }),
    accounts: selectField(
      control.accounts,
      r => `${r.code}: ${r.name}`,
      control.accountsUpdate,
    ),
    categories: selectField(
      control.categories,
      r => `${r.code || '???'}: ${r.name}`,
    ),
    statuses: selectField(control.status),
    txSplits: freeze({
      onClick: h => {
        control.transationsUpdate.addEventListener('click', h);
      },
      onApply: h => {
        control.transationsPatch.addEventListener('click', h);
      },
      getRange: () => ({
        from: control.txFrom.valueAsDate,
        to: control.txTo.valueAsDate,
      }),
      /**
       *
       * @param {TxJoin[]} joined
       * @param {Map<string, GcTx>} gcTxs
       * @param {Map<number, LmTx>} lmTxs
       */
      set: (joined, gcTxs, lmTxs) => {
        control.txSplits.replaceChildren(
          ...joined.map(j => {
            const { tx_guid: guid, plaid } = j;
            const txl = lmTxs.get(plaid) || fail(plaid);
            const txg = gcTxs.get(guid || fail('wanted')) || fail(guid);
            const title = JSON.stringify({ ...j, ...{ splits: txg.splits } });
            const entriesLM = [
              'date',
              'plaid_account',
              'payee',
              'amount',
              'category',
              'notes',
              'status',
            ].map(p => [p, txl[p]]);
            const entriesGC = [
              ['description', txg.description],
              ['memo', txg.splits[1].memo],
            ];
            return elt(
              'tr',
              { id: `${plaid}`, title },
              [...entriesLM, ...entriesGC].map(([prop, val]) =>
                elt(
                  'td',
                  {
                    class: `${prop} ${typeof val} ${
                      prop === 'status' ? val : ''
                    }`,
                  },
                  [elt('span', {}, [`${val || ''}`])],
                ),
              ),
            );
          }),
        );
      },
    }),
  };
  return fields;
};

/** @typedef { Record<string, string|number|boolean> } Query */

/**
 * @param {string} path
 * @param {Query} params
 */
const urlQuery = (path, params) => {
  const q = path.endsWith('?') ? '' : '?';
  const encoded = entries(params)
    .map(([prop, val]) => `${prop}=${encodeURIComponent(val)}`)
    .join('&');
  return `${path}${q}${encoded}`;
};

/** @param {string} notes */
const extractLMid = notes => {
  const parts = notes.match(/lm:(?<id>\d+)/);
  if (!parts) return undefined;
  return Number(parts?.groups?.id);
};

/** @param {string} desc */
const extractCode = desc => {
  const parts = (desc || '').match(/code:\s*(?<code>\S+)/);
  if (!parts) return undefined;
  return parts?.groups?.code;
};

/**
 * @param {GcAcct} gcAcct
 * @param {Map<number, LmAcct>} lmAcctsById
 * @typedef {{ guid: string, account_type: string, name: string, code?: string, notes?: string }} GcAcct
 * @typedef {{ id: number, display_name: string }} LmAcct
 * @returns {AcctJoin[]}
 */
const joinMatchingAccount = (gcAcct, lmAcctsById) => {
  if (!gcAcct.code) return [];
  if (!gcAcct.notes) return [];
  const id = extractLMid(gcAcct.notes);
  if (!id) return [];
  const lmAcct = lmAcctsById.get(id);
  if (!lmAcct) return [];
  return [
    {
      guid: gcAcct.guid,
      code: gcAcct.code,
      account_type: gcAcct.account_type,
      plaid: lmAcct.id,
    },
  ];
};

/**
 * Lunch Money left join GnuCash
 *
 * @param {LmTx} lmTx
 * @param {AcctJoin[]} acctJoin
 * @param {GcTx[]} gcTxs
 *
 * @typedef {{ plaid: number, tx_guid?: string }} TxJoin
 * @typedef {{ guid: string, code: string, account_type: string, plaid: number }} AcctJoin
 * @typedef {{
 *   tx_guid: string,
 *   num: string,
 *   date: string,
 *   description: string,
 *   splits: {code: string, amount: number, value: number, account: string, split_guid: string, memo: string}[]}
 * } GcTx
 * @typedef {{
 *   id: number,
 *   date: string,
 *   payee: string,
 *   plaid_account_id?: number,
 *   category_id: number | null,
 *   notes: string | null,
 *   amount: string,
 *   status: string
 * }} LmTx
 * @typedef {{ id: number, name: string, description: string }} LmCat
 * @returns {TxJoin[]}
 */
const joinMatchingTx = (lmTx, acctJoin, gcTxs) => {
  const acct = acctJoin.find(a => a.plaid === lmTx.plaid_account_id);
  if (!acct) return [{ plaid: lmTx.id }];
  const sign = -1; // ['BANK'].includes(acct.account_type) ? -1 : 1;
  const found = gcTxs.filter(
    tx =>
      lmTx.date === tx.date &&
      tx.splits[0].code === acct.code &&
      Number(lmTx.amount) === sign * tx.splits[0].value,
  );
  if (found.length === 0) return [{ plaid: lmTx.id }];
  if (found.length > 1) {
    console.warn('AMBIGUOUS!', found);
    return [];
  }
  return [{ tx_guid: found[0].tx_guid, plaid: lmTx.id }];
};

/**
 * @param {Object} io
 * @param {(sel: string) => Element} io.$
 * @param {typeof fetch} io.fetch
 * @param {typeof localStorage} io.localStorage
 * @param {(tag: string) => Element} io.createElement
 * @param {(tag: string) => Text} io.createTextNode
 * @param {() => number} io.clock
 */
export function ui({
  $,
  fetch,
  localStorage,
  createElement,
  createTextNode,
  clock,
}) {
  const fields = makeFields({ createElement, createTextNode, $ });

  /**
   * @template I
   * @template {Record<string, any>} R
   * @param {string} name
   * @param {I} itemEx
   * @param {R} _rowEx
   */
  const storageTable = (name, itemEx, _rowEx) => {
    const k = { d: `d.${name}`, m: `m.${name}` };
    // ISSUE: awkward type. split item vs. table apart?
    /** @type {{lastUpdated?: number} & ({value: I} & {keys: unknown[]})} */
    let info = { value: itemEx, keys: [] };
    const tryInit = () => {
      const init = localStorage.getItem(k.m);
      if (init) {
        try {
          info = JSON.parse(init);
        } catch (err) {
          console.error(err);
        }
      }
      return info;
    };
    tryInit();
    return freeze({
      get: () => info.value,
      /** @param {I} value */
      set: value => {
        info = { ...info, value, lastUpdated: clock() };
        localStorage.setItem(k.m, JSON.stringify(info));
      },
      /**
       * @param {R[]} records
       * @param {(r: R) => unknown} getKey
       */
      insertMany: (records, getKey = r => r.id) => {
        const keys = records.map(getKey);
        info = { ...info, keys, lastUpdated: clock() };
        localStorage.setItem(k.m, JSON.stringify(info));
        records.forEach((r, ix) => {
          const key = keys[ix];
          // ISSUE: garbage collect storage items?
          localStorage.setItem(`${k.d}/${key}`, JSON.stringify(r));
        });
      },
      keys: () => info.keys,
      fetchMany: (maybeKeys = undefined) => {
        if (!maybeKeys) {
          tryInit();
        }
        const keys = info.keys;
        const result = [];
        for (const key of keys) {
          /** @type {R} */
          const value = JSON.parse(
            localStorage.getItem(`${k.d}/${key}`) || fail(`missing: ${key}`),
          );
          result.push(value);
        }
        return result;
      },
    });
  };

  const keyStore = storageTable('lunchmoney.app#apiKey', 's', {});
  fields.apiKey.onBlur(ev => keyStore.set(ev.target.value));

  /**
   * @template T
   * @param {string} path
   * @param {T} example
   */
  const remoteData = (path, example) => {
    return freeze({
      /** @returns {Promise<T>} */
      get: async () => {
        const apiKey = keyStore.get();
        const headers = { Authorization: `Bearer ${apiKey}` };
        const url = new URL(path, fields.endPoint.get());
        const resp = await fetch(url, { headers });
        return resp.json();
      },
      query(/** @type {Query} */ params) {
        const there = urlQuery(path, params);
        return remoteData(there, example);
      },
    });
  };

  const db = {
    accounts: {
      /** @returns {Promise<GcAcct[]>} */
      get: () => fetch('/gnucash/accounts').then(resp => resp.json()),
    },
    transactions: {
      /**
       * @param {string} code
       * @returns {Promise<GcTx[]>}
       */
      get: code =>
        fetch(urlQuery('/gnucash/transactions', { code })).then(resp =>
          resp.json(),
        ),
      patch: updates =>
        fetch('/gnucash/transactions', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(updates),
        }),
    },
  };

  const store = {
    user: storageTable('lunchmoney.app/me', {}, {}),
    plaidAccounts: storageTable(
      'lunchmoney.app/plaid_accounts',
      null,
      /** @type {LmAcct} */ ({}),
    ),
    categories: storageTable(
      'lunchmoney.app/categories',
      null,
      /** @type {LmCat} */ ({}),
    ),
    transactions: storageTable(
      'lunchmoney.app/transactions',
      null,
      /** @type {LmTx} */ ({}),
    ),
    chartOfAccounts: storageTable(
      'gnucash/accounts',
      null,
      /** @type {GcAcct} */ ({}),
    ),
    txSplits: storageTable('gnucash/txSplits', null, /** @type {GcTx} */ ({})),
    acctJoin: storageTable('join/accounts', [/** @type {AcctJoin} */ ({})], {}),
    txJoin: storageTable('join/tranactions', [/** @type {TxJoin} */ ({})], {}),
  };

  /**
   * Collect category code, payee, and memo for each match.
   *
   * @param {TxJoin[]} matches
   */
  const collectMatches = matches => {
    const lmById = new Map(
      store.transactions.fetchMany().map(tx => [tx.id, tx]),
    );
    const gcById = new Map(
      store.txSplits.fetchMany().map(tx => [tx.tx_guid, tx]),
    );
    const catById = new Map(store.categories.fetchMany().map(c => [c.id, c]));
    const joined = matches.map(m => ({
      txl: lmById.get(m.plaid) || fail(m.plaid),
      txg: gcById.get(m.tx_guid || fail('wanted')) || fail(m.tx_guid),
    }));

    const updates = joined.flatMap(({ txl, txg }) => {
      if (!txl.category_id) return [];
      const cat = catById.get(txl.category_id) || fail(txl.category_id);
      const code = extractCode(cat.description);
      if (!code) {
        console.warn('no code', cat);
        return [];
      }
      // see also: wanted
      const acctSplits = txg.splits.filter(s => s.code !== IMBALANCE_USD);
      if (acctSplits.length !== 1) {
        console.warn('ambiguous!', acctSplits);
        return [];
      }
      const [acctSplit] = acctSplits;
      const catSplits = txg.splits.filter(s => s.code === IMBALANCE_USD);
      if (catSplits.length !== 1) {
        console.warn('ambiguous!', catSplits);
        return [];
      }
      const [catSplit] = catSplits;
      return {
        guid: txg.tx_guid,
        description: txl.payee,
        splits: [
          {
            slots: [
              {
                obj_guid: acctSplit.split_guid,
                name: 'plaid',
                int64_val: txl.id,
              },
            ],
          },
          {
            guid: catSplit.split_guid,
            account: { code },
            ...(txl.notes !== null ? { memo: txl.notes } : {}),
          },
        ],
      };
    });
    return updates;
  };

  const remote = {
    user: remoteData('/v1/me', {}),
    accounts: remoteData('/v1/plaid_accounts', {
      plaid_accounts: [/** @type {LmAcct} */ ({})],
    }),
    categories: remoteData('/v1/categories', {
      categories: [/** @type {LmCat} */ ({})],
    }),
    transactions: remoteData('/v1/transactions', {
      transactions: [/** @type {LmTx} */ ({})],
    }),
  };

  /**
   * @param {GcAcct[]} gcAccts
   * @param {LmAcct[]} lmAccts
   */
  const showAccounts = (gcAccts, lmAccts) => {
    const byId = new Map(lmAccts.map(a => [a.id, a]));
    const joined = gcAccts.flatMap(a => joinMatchingAccount(a, byId));
    store.acctJoin.set(joined);
    const accts = gcAccts.filter(a => joined.find(j => j.guid === a.guid));
    fields.accounts.set(accts);
  };

  /** @type {TxJoin[]} */
  let theUpdates;

  /**
   * @param {LmTx[]} txs
   * @param {GcTx[]} gcTxs
   */
  const showTxs = (txs, gcTxs) => {
    const catById = new Map(
      store.categories.fetchMany().map(c => [c.id, c.name]),
    );
    const acctById = new Map(
      store.plaidAccounts.fetchMany().map(a => [a.id, a.display_name]),
    );

    const withNames = txs.sort(by('date', -1)).map(tx => ({
      ...tx,
      ...(tx.category_id ? { category: catById.get(tx.category_id) } : {}),
      ...(tx.plaid_account_id
        ? { plaid_account: acctById.get(tx.plaid_account_id) }
        : {}),
    }));

    const acctJoin = store.acctJoin.get();

    const joined = withNames.flatMap(tx => joinMatchingTx(tx, acctJoin, gcTxs));
    store.txJoin.set(joined);

    const lmById = new Map(withNames.map(tx => [tx.id, tx]));
    const gcById = new Map(gcTxs.map(tx => [tx.tx_guid, tx]));
    const wanted = joined.filter(
      j =>
        fields.statuses
          .getMulti()
          .includes((lmById.get(j.plaid) || fail(j.plaid)).status) &&
        j.tx_guid &&
        gcById
          .get(j.tx_guid)
          ?.splits.map(s => s.code)
          .includes(IMBALANCE_USD),
    );
    theUpdates = wanted;
    fields.txSplits.set(wanted, gcById, lmById);
  };

  const withCodes = categories =>
    categories.map(c => ({ ...c, code: extractCode(c.description) }));
  fields.accounts.onClick(_click => {
    remote.user.get().then(user => {
      console.log('user', user);
      store.user.set(user);
      fields.user.set(user);
    });
    Promise.all([db.accounts.get(), remote.accounts.get()]).then(
      ([gcAccts, { plaid_accounts: lmAccts }]) => {
        store.chartOfAccounts.insertMany(gcAccts, a => a.guid);
        store.plaidAccounts.insertMany(lmAccts);
        showAccounts(gcAccts, lmAccts);
      },
    );
    remote.categories.get().then(({ categories }) => {
      store.categories.insertMany(categories);
      fields.categories.set(withCodes(categories));
    });
  });

  fields.txSplits.onClick(_ev => {
    const range = fields.txSplits.getRange();
    Promise.all([
      remote.transactions
        .query({
          start_date: short(range.from),
          end_date: short(range.to),
          limit: 128,
        })
        .get(),
      db.transactions.get(IMBALANCE_USD),
    ]).then(([{ transactions: txs }, gcTxs]) => {
      store.transactions.insertMany(txs);
      store.txSplits.insertMany(gcTxs, tx => tx.tx_guid);

      showTxs(txs, gcTxs);
    });
  });
  fields.txSplits.onApply(_ev => {
    if (!theUpdates) return;
    const updates = collectMatches(theUpdates);
    db.transactions.patch(updates);
  });

  maybe(keyStore.get(), k => fields.apiKey.set(k));
  maybe(store.user.get(), user => fields.user.set(user));
  showAccounts(
    store.chartOfAccounts.fetchMany(),
    store.plaidAccounts.fetchMany(),
  );
  fields.categories.set(withCodes(store.categories.fetchMany()));
  showTxs(store.transactions.fetchMany(), store.txSplits.fetchMany());
}
