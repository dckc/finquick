// @ts-check
const { freeze, entries } = Object;

const maybe = (x, f) => (x ? [f(x)] : []);

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
    Object.entries(attrs).forEach(([name, value]) =>
      it.setAttribute(name, value),
    );
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
    endPoint: $('#endpoint'),
    apiKey: theInput('#apiKey'),
    user: $('#budget_name'),
    accounts: theSelect('select[name="account"]'),
    accountsUpdate: $('#updateSetup'),
    categories: theSelect('select[name="category"]'),
    transactions: $('#transactionView'),
    transationsUpdate: $('#updateTransactions'),
    txSplits: $('#txSplits'),
  });

  /**
   * @param {HTMLSelectElement} ctrl
   * @param {string} [nameProp]
   * @param {Element} [btn]
   */
  const selectField = (ctrl, nameProp = 'name', btn = undefined) =>
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
            ctrl.appendChild(elt('option', { value: r.id }, [r[nameProp]])),
          );
      },
      getCurrent: () => ctrl.value,
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
    accounts: selectField(control.accounts, 'name', control.accountsUpdate),
    categories: selectField(control.categories),
    txSplit: freeze({
      set: txs => {
        // ['date', 'num', 'description', 'account', 'value'];
        control.txSplits.replaceChildren(
          ...txs.flatMap(tx => {
            return tx.splits.map((split, ix) =>
              elt(
                'tr',
                {},
                [
                  ...(ix === 0
                    ? [tx.date, tx.num, tx.description]
                    : ['', '', '']),
                  split.value,
                  split.account,
                ].map(val => elt('td', {}, [`${val || ''}`])),
              ),
            );
          }),
        );
      },
    }),
    transactions: freeze({
      onClick: h => {
        control.transationsUpdate.addEventListener('click', h);
      },
      set: val => {
        const cols = [
          'date',
          'payee',
          'notes',
          'amount',
          'category',
          'plaid_account',
          'status',
        ];
        control.transactions.replaceChildren(
          elt(
            'tr',
            {},
            cols.map(name => elt('th', {}, [name])),
          ),
        );
        val.forEach(tx =>
          control.transactions.appendChild(
            elt(
              'tr',
              { id: `tx${tx.id}`, title: JSON.stringify(tx), class: tx.status },
              cols.map(field =>
                elt('td', {}, [elt('span', {}, [`${tx[field] || ''}`])]),
              ),
            ),
          ),
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

const withMatchingAccount = (gcAcct, lmAcctsById) => {
  if (!gcAcct.notes) return gcAcct;
  const id = extractLMid(gcAcct.notes);
  if (!id) return gcAcct;
  const lmAcct = lmAcctsById.get(id);
  if (!lmAcct) return gcAcct;
  return { ...gcAcct, plaid: lmAcct };
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

  /** @param {string} name */
  const storageTable = name => {
    const k = { d: `d.${name}`, m: `m.${name}` };
    // ISSUE: awkward type. split item vs. table apart?
    /** @type {{lastUpdated?: number} & ({value: unknown} & {keys: unknown[]})} */
    let info = { value: undefined, keys: [] };
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
      set: value => {
        info = { ...info, value, lastUpdated: clock() };
        localStorage.setItem(k.m, JSON.stringify(info));
      },
      /**
       * @template {Record<string, any>} T
       * @param {T[]} records
       * @param {(r: T) => unknown} getKey
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
          const value = JSON.parse(
            localStorage.getItem(`${k.d}/${key}`) || fail(`missing: ${key}`),
          );
          result.push(value);
        }
        return result;
      },
    });
  };

  const keyStore = storageTable('lunchmoney.app#apiKey');
  fields.apiKey.onBlur(ev => keyStore.set(ev.target.value));

  /** @param {string} path */
  const remoteData = path => {
    return freeze({
      get: async () => {
        const apiKey = keyStore.get();
        const headers = { Authorization: `Bearer ${apiKey}` };
        const url = new URL(path, fields.endPoint.get());
        const resp = await fetch(url, { headers });
        return resp.json();
      },
      query(/** @type {Query} */ params) {
        const there = urlQuery(path, params);
        return remoteData(there);
      },
    });
  };

  const db = {
    accounts: {
      get: () => fetch('/gnucash/accounts').then(resp => resp.json()),
    },
    transactions: {
      /** @param {string} code */
      get: code =>
        fetch(urlQuery('/gnucash/transactions', { code })).then(resp =>
          resp.json(),
        ),
    },
  };

  const store = {
    user: storageTable('lunchmoney.app/me'),
    plaidAccounts: storageTable('lunchmoney.app/plaid_accounts'),
    categories: storageTable('lunchmoney.app/categories'),
    transactions: storageTable('lunchmoney.app/transactions'),
    chartOfAccounts: storageTable('gnucash/accounts'),
    txSplits: storageTable('gnucash/txSplits'),
  };

  const remote = {
    user: remoteData('/v1/me'),
    accounts: remoteData('/v1/plaid_accounts'),
    categories: remoteData('/v1/categories'),
    transactions: remoteData('/v1/transactions'),
  };

  fields.accounts.onClick(_click => {
    remote.user.get().then(user => {
      console.log('user', user);
      store.user.set(user);
      fields.user.set(user);
    });
    Promise.all([db.accounts.get(), remote.accounts.get()]).then(
      ([gcAccts, { plaid_accounts: lmAccts }]) => {
        const byId = new Map(lmAccts.map(a => [a.id, a]));
        const joined = gcAccts.map(a => withMatchingAccount(a, byId));
        store.chartOfAccounts.insertMany(joined, a => a.guid);
        store.plaidAccounts.insertMany(lmAccts);
        const accts = joined.filter(a => !!a.plaid);
        fields.accounts.set(accts);
      },
    );
    remote.categories.get().then(({ categories }) => {
      store.categories.insertMany(categories);
      fields.categories.set(categories);
    });
  });

  const IMBALANCE_USD = '9001';

  const by = (prop, d = 1) => (a, b) =>
    // eslint-disable-next-line no-nested-ternary
    a[prop] === b[prop] ? 0 : d * (a[prop] < b[prop] ? -1 : 1);

  fields.transactions.onClick(_ev => {
    remote.transactions.get().then(({ transactions: txs }) => {
      const catById = new Map(
        store.categories.fetchMany().map(c => [c.id, c.name]),
      );
      const acctById = new Map(
        store.plaidAccounts.fetchMany().map(a => [a.id, a.display_name]),
      );
      const withNames = txs.sort(by('date', -1)).map(tx => ({
        ...tx,
        category: catById.get(tx.category_id),
        plaid_account: acctById.get(tx.plaid_account_id),
      }));
      store.transactions.insertMany(withNames);
      fields.transactions.set(withNames);
    });

    db.transactions.get(IMBALANCE_USD).then(txs => {
      store.txSplits.insertMany(txs, tx => tx.tx_guid);
      fields.txSplit.set(txs);
    });
  });

  maybe(keyStore.get(), k => fields.apiKey.set(k));
  maybe(store.user.get(), user => fields.user.set(user));
  fields.accounts.set(store.plaidAccounts.fetchMany());
  fields.categories.set(store.categories.fetchMany());
  fields.transactions.set(store.transactions.fetchMany());
}
