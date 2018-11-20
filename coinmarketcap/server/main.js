/* global require */

const cheerio = require('cheerio');

const CMC = 'https://coinmarketcap.com';

async function main({ get }) {
  const [start, end] = ['20180820', '20181120'];
  const name = 'rchain';

  const text = await fetchPriceText(get, name, start, end);
  console.log(text.slice(0, 200));
  const { columns, rows } = parsePrices(cheerio.load(text));

  const records = rows.map(toRecord(columns));
  
  console.log(records);
}

function toRecord(columns) {
  return row => row.reduce((acc, cell, ix) => ({ [columns[ix]]: cell, ...acc }), {});
}


async function fetchPriceText(get, name, start, end) {
  const addr = `${CMC}/currencies/${name}/historical-data/?start=${start}&end=${end}`;
  console.log({ addr });
  const res = await send(cb => get(addr, cb));
  console.log('status', res.statusCode);
  if (res.statusCode != 200) {
    throw new Error(res.statusMessage);
  }
  return fetchText(res);
}


function fetchText(res) {
  res.setEncoding('utf8');
  let text = '';

  res.on('data', (chunk) => { text += chunk; });
  return new Promise((resolve, reject) => {
    res.on('end', () => {
      resolve(text);
    }).on('error', (e) => {
      console.error(`Got error: ${e.message}`);
      reject(e);
    });
  });
}


function parsePrices($) {
  const table = $('.tab-content table');
  const columns = $('thead tr th', table)
          .map((_, th) => $(th).text().replace(/\*/g, '')).get();
  const parse = (ix, txt) => (ix > 0
                              ? parseFloat(txt.replace(/,/g, ''))
                              : new Date(txt));
  const rows = $('tbody tr', table)
          .map((_, tr) => $('td', $(tr))
               .map((ix, td) => parse(ix, $(td).text()))).get()
          .map(row => row.get())
          .slice(1);
  return { columns, rows };
}


function _logged({ node, collection }, label) {
  console.log('====');
  if (node) {
    console.log(label || ': ', node.tagName, node.childNodes.length);
    return node;
  } else {
    console.log(label || ': ', collection.length);
    return collection;
  }
}


/**
 * Adapt callback-style API using Promises.
 *
 * Instead of obj.method(...arg, callback),
 * use send(cb => obj.method(...arg, cb)) and get a promise.
 *
 * @param calling: a function of the form (cb) => o.m(..., cb)
 * @return A promise for the result passed to cb
 */
function send/*:: <T>*/(calling) /*: Promise<T> */{
  function executor(resolve, reject) {
    const callback = (result) => {
    // const callback = (err, result) => {
    //   if (err) {
    //     reject(err);
    //   }
      resolve(result);
    };

    calling(callback);
  }

  return new Promise(executor);
}


// Access ambient stuff only when invoked as main module.
/* global module */
if (require.main === module) {
  /* eslint-disable global-require */
  try {
    main({
      get: require('https').get,
    });
  } catch (oops) { console.log(oops); }
}
