/* global require */
// @flow

const cheerio = require('cheerio');

const { makeSessionBus, secretSpace } = require('../../desktop/server/main');
const { makeDB } = require('../../ofxies/server/budget');

const CMC = 'https://coinmarketcap.com';
const DB = 'dm93finance'; //ISSUE: docopt


async function main({ env, pid, get, mysql, abstractSocket }) {
  const [start, end] = ['20180820', '20181120']; // ISSUE: docopt
  const name = 'rchain'; // ISSUE: docopt

  const text = await fetchPriceText(get, name, start, end);
  console.log(text.slice(0, 200));
  const { columns, rows } = parsePrices(cheerio.load(text));

  console.log(rows.slice(0, 3));
  const records = rows.map(toRecord(columns));
  
  console.log(records.slice(0, 3));
  const db = await dbAccess({ env, pid, mysql, abstractSocket });
  await savePrices(db, rows);
}

function toRecord(columns) {
  return row => row.reduce((acc, cell, ix) => ({ [columns[ix]]: cell, ...acc }), {});
}


async function savePrices(db, rows) {
  const tx0 = await db.begin();
  // ISSUE: DDL doesn't fit in a transaction;
  await tx0.update('create table if not exists cmc_prices (`Date` date, `Open` numeric(24, 8), `High` numeric(24, 8), `Low` numeric(24, 8), `Close` numeric(24, 8), `Volume` numeric(24, 8), `Market Cap` numeric(24, 8))');
  await tx0.update('truncate table cmc_prices'); // ISSUE: delete between start and end
  await tx0.commit();
  const tx = await db.begin();
  await tx.update('insert into cmc_prices values ?', null, [rows]);
  await tx.commit();
}


async function dbAccess({ env, pid, mysql, abstractSocket }) {
  const sessionBus = makeSessionBus(env.DBUS_SESSION_BUS_ADDRESS || '',
                                    abstractSocket.connect);
  const keyChain = secretSpace(sessionBus, {
    protocol: 'mysql',
    server: 'localhost',
  });
  const cred = await keyChain.lookup();

  const optsP = Promise.resolve({
      host     : 'localhost',
      user     : env.LOGNAME,
      password : cred.secret,
      database : DB,
  });

  return makeDB(
    mysql, null /*events*/,
    {
      pid: pid,
      hostname: () => 'localhost'
    },  //ISSUE: localhost -> docopt
    optsP);
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
                              : new Date(txt + ' 0:0 UTC'));
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
/* global module, process */
if (require.main === module) {
  /* eslint-disable global-require */
  try {
    main({
      env: process.env,
      pid: process.pid,
      get: require('https').get,
      mysql: require('mysql'),
      abstractSocket: require('abstract-socket'),
    })
      .then((_) => {
        process.exit(0);
      });
  } catch (oops) {
    console.log(oops);
    process.exit(1);
  }
}
