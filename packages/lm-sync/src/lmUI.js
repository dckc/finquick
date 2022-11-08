const { freeze } = Object;
const { log } = console;

const maybe = (x, f) => (x ? [f(x)] : []);
const fmt = obj => JSON.stringify(obj, null, 2);

/**
 * @param {Object} io
 * @param {typeof document.querySelector} io.$
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

  const fields = {
    endPoint: freeze({
      get: () => $('#endpoint').getAttribute('href'),
    }),
    apiKey: freeze({
      set: val => ($('#apiKey').value = val),
      onBlur: h => $('#apiKey').addEventListener('blur', h),
    }),
    accounts: freeze({
      set: val => {
        const control = $('select[name="account"]');
        control.replaceChildren();
        val
          .filter(({ status }) => status !== 'inactive')
          .forEach(({ id, name }) =>
            control.appendChild(elt('option', { value: id }, [name])),
          );
      },
      onClick: h => {
        $('#updateAccounts').addEventListener('click', h);
      },
    }),
  };

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

  const book = {
    accounts: storageItem('lunchmoney.app/plaid_accounts'),
  };

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

  fields.apiKey.onBlur(ev => keyStore.set(ev.target.value));

  const remote = {
    accounts: remoteData('/v1/plaid_accounts'),
  };

  fields.accounts.onClick(_click => {
    remote.accounts.get().then(({ plaid_accounts: accts }) => {
      book.accounts.set(accts);
      fields.accounts.set(accts);
    });
  });

  maybe(keyStore.get(), k => fields.apiKey.set(k));
  maybe(book.accounts.get(), accts => fields.accounts.set(accts));
}
