// @ts-check

import { allValues } from './promiseUtil.js';

const pages = {
  // package-relative
  '/': { path: './ui/index.html', type: 'text/html' },
  '/txUi.js': { path: './ui/txUi.js', type: 'application/javascript' },
  '/report.css': { path: './ui/report.css', type: 'text/css' },
  '/txs': { path: './data/split_detail.json', type: 'application/json' },
};

const die = (msg = '') => {
  throw Error(msg);
};

/**
 * @param {typeof process.env} env
 * @param {object} io
 * @param {typeof import('https')} io.https
 * @param {typeof import('fs/promises')} io.fsp TODO: narrow to least authority
 * @param {typeof import('devcert')} io.devcert
 */
const main = async (env, { https, fsp, devcert }) => {
  const { readFile } = fsp;
  const ssl = await devcert.certificateFor(
    env.DOMAIN || die('$DOMAIN missing'),
  );
  const srv = https.createServer(ssl, (request, response) => {
    const { url } = request;
    console.log('@@request for', url);
    const page = pages[url];
    if (!page) {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end();
      return;
    }
    readFile(page.path, 'utf8').then(body => {
      response.writeHead(200, { 'content-type': page.type });
      response.write(body);
      response.end();
    }); // TODO: catch
  });
  const port = env.PORT || 443;
  console.warn('listening on https://%s:%s', env.DOMAIN, port);
  srv.listen(port);
};

(async () =>
  main(
    process.env,
    await allValues({
      https: import('https'),
      fsp: import('fs/promises'),
      devcert: import('devcert'),
    }),
  ))().catch(err => console.error(err));
