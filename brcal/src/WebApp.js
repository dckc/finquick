// @ts-check

const { freeze } = Object;

/**
 * @param {string} url
 * @param {{
 *   https: typeof import('https'), // follow-redirects?
 * }} io
 */
export function WebApp(url, { https }) {
  return freeze({
    url,
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
