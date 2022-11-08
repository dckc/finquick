// @ts-check
const { freeze } = Object;

const maybe = (x, f) => (x ? [f(x)] : []);

const fail = why => {
  throw Error(why);
};

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
  const selectInput = sel => {
    const it = $(sel);
    // eslint-disable-next-line no-undef
    if (!(it instanceof HTMLInputElement)) throw TypeError();
    return it;
  };
  const control = freeze({
    endPoint: $('#endpoint'),
    apiKey: selectInput('#apiKey'),
    accounts: $('select[name="account"]'),
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
    accounts: freeze({
      onClick: h => {
        control.accountsUpdate.addEventListener('click', h);
      },
      set: val => {
        control.accounts.replaceChildren();
        val
          .filter(({ status }) => status !== 'inactive')
          .forEach(({ id, name }) =>
            control.accounts.appendChild(elt('option', { value: id }, [name])),
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
    });
  };

  const book = {
    accounts: storageItem('lunchmoney.app/plaid_accounts'),
    transactions: storageItem('lunchmoney.app/transactions'),
  };

  const remote = {
    accounts: remoteData('/v1/plaid_accounts'),
    transactions: remoteData('/v1/transactions'),
  };

  fields.accounts.onClick(_click => {
    remote.accounts.get().then(({ plaid_accounts: accts }) => {
      book.accounts.set(accts);
      fields.accounts.set(accts);
    });
  });

  fields.transactions.onClick(_ev => {
    remote.transactions.get().then(({ transactions: txs }) => {
      book.transactions.set(txs);
      fields.transactions.set(txs);
    });
  });
  maybe(keyStore.get(), k => fields.apiKey.set(k));
  maybe(book.accounts.get(), accts => fields.accounts.set(accts));
  maybe(book.transactions.get(), txs => fields.transactions.set(txs));
}