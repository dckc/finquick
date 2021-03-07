// @ts-check

import { URL } from 'url';

const { freeze, entries } = Object;

/**
 * @param {Query} params
 * @returns {string}
 *
 * @typedef { Record<string, string|number|boolean> } Query
 */
export function urlencode(params) {
  return entries(params)
    .map(([prop, val]) => `${prop}=${encodeURIComponent(val)}`)
    .join('&');
}

/**
 * @param {string} url
 * @param {{
 *   https: typeof import('https'), // follow-redirects?
 * }} io
 * @param {Headers=} headers
 *
 * @typedef {Record<string, string | number | string []>} Headers
 */
export function WebApp(url, { https }, headers) {
  return freeze({
    url,
    pathjoin(/** @type { string } */ ref) {
      return WebApp(`${new URL(ref, url)}`, { https });
    },
    withHeaders(/** @type { Headers } */ h) {
      return WebApp(url, { https }, { ...headers, ...h });
    },
    query(/** @type {Query} */ params) {
      const q = url.endsWith('?') ? '' : '?';
      const there = `${url}${q}${urlencode(params)}`;
      return WebApp(there, { https });
    },
    /**
     * @param {((h: Record<string, string>) => void)=} onHeaders
     * @returns {Promise<string>}
     */
    async get(onHeaders) {
      return new Promise((resolve, reject) => {
        const req = https.get(url, { method: 'GET', headers }, response => {
          let str = '';
          // console.log('Response is ' + response.statusCode);
          response.on('data', chunk => {
            str += chunk;
          });
          if (onHeaders) {
            response.on('headers', onHeaders);
          }
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
            { method: 'POST', headers },
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

/**
 * @param {ReturnType<WebApp>} web
 * @param {() => Promise<void> } delay
 * @returns {ReturnType<typeof WebApp>}
 */
export function rateLimit(web, delay) {
  /** @type {Promise<void>?} */
  let pause;

  return freeze({
    url: web.url,
    pathjoin: ref => rateLimit(web.pathjoin(ref), delay),
    query: params => rateLimit(web.query(params), delay),
    withHeaders: h => rateLimit(web.withHeaders(h), delay),
    async get(onHeaders) {
      if (pause) await pause;
      const result = await web.get(onHeaders);
      pause = delay();
      return result;
    },
    async post(body) {
      if (pause) await pause;
      const result = await web.post(body);
      pause = delay();
      return result;
    },
  });
}
