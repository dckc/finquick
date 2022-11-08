const { freeze } = Object;
const { log } = console;

const maybe = (x, f) => (x ? [f(x)] : []);

/**
 * @param {{
 *   $: typeof document.querySelector,
 *   fetch: typeof fetch,
 *   localStorage: typeof localStorage,
 * }} io
 */
export function ui({ $, fetch, localStorage }) {
  const fmt = obj => JSON.stringify(obj, null, 2);
  const endPoint = $('#endpoint').getAttribute('href');

  /** @param {string} k */
  const storageItem = k => {
    const val = localStorage.getItem(k);
    let current;
    if (val) {
      try {
        current = JSON.parse(val);
      } catch (err) {
        console.error(err);
      }
    }
    return freeze({
      get: () => current,
      set: v => {
        current = v;
        localStorage.setItem(k, JSON.stringify(v));
      },
    });
  };

  const keyStore = storageItem('lunchmoney.app#apiKey');
  const accountStore = storageItem('lunchmoney.app/plaid_accounts');

  /** @param {string} path */
  const remoteData = path => {
    return freeze({
      get: async () => {
        const apiKey = keyStore.get();
        const headers = { Authorization: `Bearer ${apiKey}` };
        const url = new URL(path, endPoint);
        const resp = await fetch(url, { headers });
        return resp.json();
      },
    });
  };

  maybe(keyStore.get(), k => ($('#apiKey').value = k));
  $('#apiKey').addEventListener('blur', ev => keyStore.set(ev.target.value));

  const accounts = remoteData('/v1/plaid_accounts');
  maybe(accountStore.get(), accts => ($('#result').value = fmt(accts)));

  $('#fetch').addEventListener('click', _click => {
    accounts.get().then(data => {
      accountStore.set(data);
      $('#result').value = fmt(data);
    });
  });
}
