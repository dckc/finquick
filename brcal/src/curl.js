// @ts-check

/**
 * @param {string} url
 * @param {{ https: typeof import('https') }} io
 * @returns {Promise<string>}
 */
export function curl(url, { https }) {
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
}

/**
 * @param {{ https: typeof import('https') }} io
 * @returns { typeof fetch }
 */
export function nodeFetch({ https }) {
  /** @type { typeof fetch } */
  function fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
      const { method = 'GET', body, headers } = options;
      if (typeof url !== 'string') {
        throw new Error('not implemented');
      }
      const req = https.request(url, { method, headers }, res => {
        res.setEncoding('utf8');
        let content = '';
        res.on('data', data => {
          content += data;
        });

        res.on('end', () => {
          /** @type any */
          const response = {
            ok: res.statusCode && res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            statusText: res.statusMessage,
            text: () => content,
            json: () => JSON.parse(content),
          };
          resolve(response);
        });
      });
      if (body !== undefined) {
        req.write(body);
      }
      req.on('error', reject);
      req.end();
    });
  }

  return fetch;
}
