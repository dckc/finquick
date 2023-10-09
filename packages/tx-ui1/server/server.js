// @ts-check

const pages = {
  // package-relative
  '/': { path: './ui/index.html', type: 'text/html' },
  '/txUi.js': { path: './ui/txUi.js', type: 'application/javascript' },
  '/report.css': { path: './ui/report.css', type: 'text/css' },
  '/txs': { path: './data/split_detail.json', type: 'application/json' },
};

/**
 * @param {object} io
 * @param {typeof import('http')} io.http
 * @param {typeof import('fs')} io.fs TODO: narrow to least authority
 */
const main = async ({ http, fs }) => {
  const srv = http.createServer((request, response) => {
    const { url } = request;
    console.log('@@request for', url);
    const page = pages[url];
    if (!page) {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end();
      return;
    }
    fs.promises.readFile(page.path, 'utf8').then(body => {
      response.writeHead(200, { 'content-type': page.type });
      response.write(body);
      response.end();
    });
  });
  srv.listen(8080);
};

(async () =>
  main({ http: await import('http'), fs: await import('fs') }))().catch(err =>
  console.error(err),
);
