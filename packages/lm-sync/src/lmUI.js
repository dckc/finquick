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
    accountsUpdate: $('#updateAccounts'),
    transactions: $('#transactionView'),
    transationsUpdate: $('#updateTransactions'),
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
    accounts: freeze({
      onClick: h => {
        control.accountsUpdate.addEventListener('click', h);
      },
      set: val => {
        control.accounts.replaceChildren();
        val
          .filter(({ status }) => status !== 'inactive')
          .forEach(({ id, display_name: name }) =>
            control.accounts.appendChild(elt('option', { value: id }, [name])),
          );
      },
      getCurrent: () => control.accounts.value,
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

  /** @param {string} key */
  const storageItem = key => {
    const k = { d: `d.${key}`, m: `m.${key}` };
    const init = localStorage.getItem(k.d);
    let current;
    if (init) {
      try {
        current = JSON.parse(init);
      } catch (err) {
        console.error(err);
      }
    }
    return freeze({
      get: () => current,
      set: val => {
        current = val;
        const meta = { lastUpdated: clock() };
        localStorage.setItem(k.d, JSON.stringify(val));
        localStorage.setItem(k.m, JSON.stringify(meta));
      },
    });
  };

  const keyStore = storageItem('lunchmoney.app#apiKey');
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

  const book = {
    user: storageItem('lunchmoney.app/me'),
    accounts: storageItem('lunchmoney.app/plaid_accounts'),
    transactions: storageItem('lunchmoney.app/transactions'),
  };

  const remote = {
    user: remoteData('/v1/me'),
    accounts: remoteData('/v1/plaid_accounts'),
    transactions: remoteData('/v1/transactions'),
  };

  fields.accounts.onClick(_click => {
    remote.user.get().then(user => {
      console.log('user', user);
      book.user.set(user);
      fields.user.set(user);
    });
    remote.accounts.get().then(({ plaid_accounts: accts }) => {
      book.accounts.set(accts);
      fields.accounts.set(accts);
    });
  });

  fields.transactions.onClick(_ev => {
    remote.transactions
      .query({ plaid_account_id: fields.accounts.getCurrent() })
      .get()
      .then(({ transactions: txs }) => {
        book.transactions.set(txs);
        fields.transactions.set(txs);
      });
  });
  maybe(keyStore.get(), k => fields.apiKey.set(k));
  maybe(book.user.get(), user => fields.user.set(user));
  maybe(book.accounts.get(), accts => fields.accounts.set(accts));
  maybe(book.transactions.get(), txs => fields.transactions.set(txs));
}
