// @ts-check

const { freeze, entries } = Object;

/**
 * @param {Query} params
 * @returns {string}
 *
 * @typedef { Record<string, string|number|boolean> } Query
 */
function urlencode(params) {
  return entries(params)
    .map(([prop, val]) => `${prop}=${encodeURIComponent(val)}`)
    .join('&');
}

/**
 * @param {string} url
 * @param {{
 *   https: typeof import('https'), // follow-redirects?
 * }} io
 */
export function WebApp(url, { https }) {
  return freeze({
    url,
    query(/** @type {Query} */ params) {
      const q = url.endsWith('?') ? '' : '?';
      const there = `${url}${q}${urlencode(params)}`;
      return WebApp(there, { https });
    },
    async get() {
      return new Promise((resolve, reject) => {
        const req = https.get(url, response => {
          let str = '';
          // console.log('Response is ' + response.statusCode);
          response.on('data', chunk => {
            str += chunk;
          });
          response.on('end', () => resolve(str));
        });
        req.end();
        req.on('error', reject);
      });
    },
    /**
     * @param {string} body
     * @returns {Promise<string>}
     */
    async post(body) {
      return new Promise((resolve, reject) => {
        const /** @type { import('http').ClientRequest } */ req = https.request(
            url,
            { method: 'POST' },
            // @ts-ignore
            response => {
              let str = '';
              // console.log('Response is ' + response.statusCode);
              response.on('data', chunk => {
                str += chunk;
              });
              response.on('end', () => resolve(str));
            },
          );
        req.write(body);
        req.end();
        req.on('error', reject);
      });
    },
  });
}