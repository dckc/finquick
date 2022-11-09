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
          .filter(({ status }) => status !== 'inactive')
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
    accounts: selectField(
      control.accounts,
      'display_name',
      control.accountsUpdate,
    ),
    categories: selectField(control.categories),
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
          'category_id',
          'plaid_account_id',
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
              { id: `tx${tx.id}`, title: JSON.stringify(tx) },
              cols.map(field => elt('td', {}, [`${tx[field] || ''}`])),
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
        const q = path.endsWith('?') ? '' : '?';
        const encoded = entries(params)
          .map(([prop, val]) => `${prop}=${encodeURIComponent(val)}`)
          .join('&');
        const there = `${path}${q}${encoded}`;
        return remoteData(there);
      },
    });
  };

  const store = {
    user: storageTable('lunchmoney.app/me'),
    accounts: storageTable('lunchmoney.app/plaid_accounts'),
    categories: storageTable('lunchmoney.app/categories'),
    transactions: storageTable('lunchmoney.app/transactions'),
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
    remote.accounts.get().then(({ plaid_accounts: accts }) => {
      store.accounts.insertMany(accts);
      fields.accounts.set(accts);
    });
    remote.categories.get().then(({ categories }) => {
      store.categories.insertMany(categories);
      fields.categories.set(categories);
    });
  });

  fields.transactions.onClick(_ev => {
    remote.transactions
      .query({ plaid_account_id: fields.accounts.getCurrent() })
      .get()
      .then(({ transactions: txs }) => {
        store.transactions.insertMany(txs);
        fields.transactions.set(txs);
      });
  });
  maybe(keyStore.get(), k => fields.apiKey.set(k));
  maybe(store.user.get(), user => fields.user.set(user));
  fields.accounts.set(store.accounts.fetchMany());
  fields.categories.set(store.categories.fetchMany());
  fields.transactions.set(store.transactions.fetchMany());
}
