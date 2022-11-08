const { freeze } = Object;
const { log } = console;

/**
 * @param {{
 *   $: typeof document.querySelector,
 *   fetch: typeof fetch,
 * }} io
 */
export function ui({ $, fetch }) {
  const fmt = obj => JSON.stringify(obj, null, 2);
  const endPoint = $('#endpoint').getAttribute('href');

  $('#fetch').addEventListener('click', _click => {
    const apiKey = $('#apiKey').value;
    const creds = { Authorization: `Bearer ${apiKey}` };

    const url = new URL('/v1/plaid_accounts', endPoint);
    console.log({ url });
    fetch(url, { headers: creds }).then(async resp => {
      const data = await resp.json();
      $('#result').value = fmt(data);
    });
  });
}
