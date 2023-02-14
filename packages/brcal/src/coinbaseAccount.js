// @ts-check
import { createHmac } from 'crypto';
import requireText from 'require-text';

import { rateLimit, WebApp, urlencode } from './WebApp';
import { check } from './check';
import { GCBook } from './gcbook';

const { freeze } = Object;
const { floor } = Math;

const Sha256 = freeze({
  /**
   * @param { Bytes } value
   * @param { Bytes } key
   * @returns { Bytes }
   * @typedef {Uint8Array} Bytes
   */
  hmac(value, key) {
    const hmac = createHmac('sha256', key);
    hmac.update(value);
    return hmac.digest();
  },
});

const UTF8 = freeze(
  (encoder => ({
    /** @type {(s: string) => Bytes} */
    encode: s => encoder.encode(s),
  }))(new TextEncoder()),
);

const Base16 = freeze({
  /** @type {(bs: Bytes) => string} */
  encode(bs) {
    return Buffer.from(bs).toString('hex');
  },
  /** @type {(txt: string) => Bytes} */
  decode(hx) {
    return Buffer.from(hx, 'hex');
  },
});

const Base64 = freeze({
  /** @param {string} txt */
  decode: txt => Buffer.from(txt, 'base64'),
  /** @param {Bytes} bs */
  encode: bs => Buffer.from(bs).toString('base64'),
});

const Coinbase = {
  origin: 'https://api.coinbase.com',
  url: 'https://api.coinbase.com/v2/',
  path: '/v2/',
  /**
   * @param {Bytes} secret
   * @param {number} timestamp
   * @param {'GET' | 'POST'} method
   * @param {string} path_url
   * @param {string=} body
   * @returns {Bytes}
   *
   * @typedef {import('./WebApp').Headers} Headers
   */
  signature(secret, timestamp, method, path_url, body) {
    const message = `${timestamp}${method}${path_url}${body || ''}`;

    const sig = Sha256.hmac(UTF8.encode(message), secret);
    // console.log({ timestamp, method, path_url, sig: Base16.encode(sig) });
    return sig;
  },
  /** @type {(key: string, sig: Bytes, ts: number) => Headers} */
  fmtSig(key, signature, timestamp) {
    return {
      'CB-VERSION': '2016-05-16',
      'CB-ACCESS-KEY': key,
      'CB-ACCESS-SIGN': Base16.encode(signature),
      'CB-ACCESS-TIMESTAMP': `${timestamp}`,
    };
  },
};

const sigTest = {
  secret: '4674676a4c486969785a4368334c367744536d466a42686b4d4d58454e6e4c79',
  timestamp: '1615068960',
  method: 'GET',
  path_url: '/v2/accounts?starting_after=bbf0d059-31c1-5f4c-9cd7-98b98089b995',
  signature: 'defa1de894c5b31a989c92f02eb4a0742ff20ee11978f85bd6af1ea5a14bfbd6',
};

function testSig() {
  const actual = Base16.encode(
    Coinbase.signature(
      Base16.decode(sigTest.secret),
      parseInt(sigTest.timestamp, 10),
      // @ts-ignore
      sigTest.method,
      sigTest.path_url,
    ),
  );
  const expected = sigTest.signature;
  console.log({ actual, expected, ok: actual === expected });
}

function assert(cond, detail) {
  if (!cond) {
    throw Error(detail);
  }
}

/**
 * @param {WebApp} endPoint
 * @param {() => Date} clock
 * @param {{ key: string, secret: Bytes}} api
 *
 * @typedef {ReturnType<typeof import('./WebApp').WebApp>} WebApp
 */
function makeCoinbase(endPoint, clock, api) {
  function logged(value, ...notes) {
    console.log(value.length, ...notes);
    return value;
  }

  /**
   * @param {string} path
   * @returns {Promise<{
   *   errors?: unknown[],
   *   pagination: { next_uri?: string },
   *   data: any[],  // TODO: type parameter
   * }>}
   */
  async function getJSON(path) {
    const ts = floor(clock().valueOf() / 1000);

    const sig = Coinbase.signature(api.secret, ts, 'GET', path);
    return JSON.parse(
      logged(
        await endPoint
          .pathjoin(path)
          .withHeaders(Coinbase.fmtSig(api.key, sig, ts))
          .get(),
        path,
      ),
    );
  }

  async function paged(result) {
    let data = result.data;
    if (!data) {
      console.log('no data!');
      return [];
    }
    console.log('data:', data.length);
    let path;
    while ((path = result.pagination.next_uri)) {
      result = await getJSON(path);
      data = [...data, ...check.notNull(result.data)]; // ISSUE: use flat()?
    }
    return data;
  }

  function accounts(id) {
    async function list() {
      // ISSUE: arg for previous pages
      // ISSUE: error handling
      const result = await getJSON('/v2/accounts');
      assert(
        !result.errors,
        `cannot list accounts: ${JSON.stringify(result.errors)}`,
      );
      return paged(result);
    }

    async function buys() {
      return paged(await getJSON(`/v2/accounts/${id}/buys`));
    }

    async function sells() {
      return paged(await getJSON(`/v2/accounts/${id}/sells`));
    }

    async function deposits() {
      return paged(await getJSON(`/v2/accounts/${id}/deposits`));
    }

    async function withdrawals() {
      return paged(await getJSON(`/v2/accounts/${id}/withdrawals`));
    }

    async function transactions() {
      const result = await getJSON(`/v2/accounts/${id}/transactions`);
      assert(
        !result.errors,
        `cannot list transactions: ${JSON.stringify(result.errors)}`,
      );
      return paged(result);
    }
    return freeze({ list, transactions, buys, sells, deposits, withdrawals });
  }

  async function time() {
    return JSON.parse(await endPoint.pathjoin('time').get());
  }

  return freeze({ time, accounts });
}

const tx1 = {
  id: '9bd30e61-de96-4a25-9c38-5b110d13a03d',
  price: '6559.90000000',
  size: '0.00250999',
  product_id: 'BTC-USD',
  side: 'sell',
  type: 'limit',
  time_in_force: 'GTC',
  post_only: true,
  created_at: '2018-10-08T05:04:45.364184Z',
  done_at: '2018-10-08T10:45:29.401Z',
  done_reason: 'filled',
  fill_fees: '0.0000000000000000',
  filled_size: '0.00250999',
  executed_value: '16.4652834010000000',
  status: 'done',
  settled: true,
};

const tx2 = {
  created_at: '2018-08-03T15:36:17.9Z',
  trade_id: 38221286,
  product_id: 'ETH-USD',
  order_id: '195c5aef-bbeb-4014-9ab8-5e62f2b20a06',
  user_id: '573a7c2b66084b3114000412',
  profile_id: '8934d7bf-413e-4179-bc52-2e6831e91fab',
  liquidity: 'M',
  price: '413.35000000',
  size: '0.11745726',
  fee: '0.0000000000000000',
  side: 'sell',
  settled: true,
  usd_volume: '48.5509584210000000',
};

const CoinbasePro = {
  origin: 'https://api.pro.coinbase.com',
  url: 'https://api.pro.coinbase.com/',
  path: '/',
  /**
   * @param {string} key
   * @param {Bytes} signature
   * @param {number} timestamp
   * @param {string} passPhrase
   */
  fmtSig(key, signature, timestamp, passPhrase) {
    return {
      'user-agent': 'madmode.com',
      'CB-ACCESS-KEY': key,
      'CB-ACCESS-SIGN': Base64.encode(signature),
      'CB-ACCESS-TIMESTAMP': timestamp,
      'CB-ACCESS-PASSPHRASE': passPhrase,
    };
  },
};

/**
 * @param {WebApp} web
 * @param {() => Date} clock
 * @param {{ key: string, secret: Bytes, passPhrase: string }} api
 */
function makeCoinbasePro(web, clock, api) {
  /**
   * @param {string} path
   * @param {Query=} params
   * @param {((h: Record<string, string>) => void)=} onHeaders
   * @returns {Promise<any[] | { message: string }>} // TODO: type parameter
   *
   * @typedef {import('./WebApp').Query} Query
   */
  async function getJSON(path, params, onHeaders) {
    const ts = floor(clock().valueOf() / 1000);

    const sigPath = params ? `${path}?${urlencode(params)}` : path;
    const sig = Coinbase.signature(api.secret, ts, 'GET', sigPath);
    return JSON.parse(
      await web
        .pathjoin(path)
        .query(params || {})
        .withHeaders(CoinbasePro.fmtSig(api.key, sig, ts, api.passPhrase))
        .get(onHeaders),
    );
  }

  async function paged(path, params) {
    let data = []; // TODO: generator
    for (;;) {
      let headers = {};
      let results = await getJSON(path, params, h => {
        headers = h;
      });
      if ('message' in results) {
        throw Error(results.message);
      }
      data = [...data, ...results];
      path = headers['cb-after'];
      if (!path) {
        break;
      }
    }
    return data;
  }

  return freeze({
    /** @param {Query=} params */
    accounts: params => paged(`/accounts`, params),
    /** @param {Query=} params */
    transfers: params => paged(`/transfers`, params),
    /** @param {Query=} params */
    orders: params => paged(`/orders`, params),
    /** @param {Query=} params */
    fills: params => paged(`/fills`, params),
  });
}

/**
 *
 * @param {ReturnType<typeof import('./gcbook').GCBook>} bk
 * @param {string} table
 * @param {T[]} records
 * @param {(r: T) => string} getId
 * @template T
 */
async function save(bk, table, records, getId) {
  console.log('saving ', records.length, 'records to ', table);
  await bk.exec(`drop table if exists ${table}`); //@@@
  await bk.exec(`create table if not exists ${table} (
    id varchar(256),
    data JSON
  ) character set=utf8 collate=utf8_general_ci`);
  await bk.exec(`insert into ${table}(id, data) values ?`, [
    records.map(r => [getId(r), JSON.stringify(r)]),
  ]);
}

/**
 * @param {string[]} args
 * @param {{
 *   env: typeof process.env,
 *   clock: () => Date,
 *   setTimeout: typeof setTimeout,
 *   https: typeof import('https'),
 *   mysql: typeof import('mysql'),
 *   require: typeof require,
 * }} io
 */
async function main(args, { env, clock, setTimeout, https, mysql, require }) {
  // By default, each API key or app is rate limited at 10,000 requests per hour.
  const period = (1 / (10000 / (60 * 60))) * 1000;
  /** @type {() => Promise<void> } */
  const delay = () => new Promise(resolve => setTimeout(resolve, period));
  const cb = makeCoinbase(
    rateLimit(WebApp(Coinbase.origin, { https }), delay),
    clock,
    {
      key: check.notNull(env.COINBASE_KEY),
      secret: UTF8.encode(check.notNull(env.COINBASE_SECRET)),
    },
  );
  const pro = makeCoinbasePro(
    rateLimit(WebApp(CoinbasePro.origin, { https }), delay),
    clock,
    {
      key: check.notNull(env.COINBASE_PRO_KEY),
      secret: Base64.decode(check.notNull(env.COINBASE_PRO_SECRET)),
      passPhrase: check.notNull(env.COINBASE_PRO_PASSPRHASE),
    },
  );

  function mkBook() {
    const connect = () =>
      Promise.resolve(
        mysql.createConnection({
          host: env.GC_HOST,
          user: env.GC_USER,
          password: env.GC_PASS,
          database: env.GC_DB,
        }),
      );
    return GCBook(connect, specifier => requireText(specifier, require));
  }

  if (args.includes('--time')) {
    console.log(await cb.time());
    console.log(clock());
    return;
  }
  if (args.includes('--test')) {
    testSig();
    return;
  }

  const bk = mkBook();

  if (args.includes('--pro')) {
    console.log('fetching coinbase pro data');
    const accounts = await pro.accounts();
    const transfers = await pro.transfers();
    const orders = await pro.orders({ status: 'all' });
    const products = [...new Set(orders.map(({ product_id }) => product_id))];
    const fills = (
      await Promise.all(products.map(product_id => pro.fills({ product_id })))
    ).flat();
    await bk.importSlots(
      'pro.coinbase.com/accounts',
      accounts.map(data => ({ id: data.id, data })),
    );
    await bk.importSlots(
      'pro.coinbase.com/transfers',
      transfers.map(data => ({ id: data.id, data })),
    );
    await bk.importSlots(
      'pro.coinbase.com/orders',
      orders.map(data => ({ id: data.id, data })),
    );
    await bk.importSlots(
      'pro.coinbase.com/fills',
      fills.map(data => ({ id: data.trade_id, data })),
    );
    bk.close();
    return;
  }

  console.log('fetching coinbase data');
  const accounts = await cb.accounts().list();

  const detail = async f =>
    (
      await Promise.all(
        accounts.map(account =>
          f(cb.accounts(account.id)).then(items =>
            items.map(item => ({ _account_id: account.id, ...item })),
          ),
        ),
      )
    ).flat();
  const kinds = {
    transactions: acct => acct.transactions(),
    buys: acct => acct.buys(),
    sells: acct => acct.sells(),
    deposits: acct => acct.deposits(),
    withdrawals: acct => acct.withdrawals(),
  };

  try {
    await bk.importSlots(
      'coinbase.com/accounts',
      accounts.map(data => ({ id: data.id, data })),
    );
    // TODO: filter accounts by updated_at?
    for (const [kind, f] of Object.entries(kinds)) {
      await bk.importSlots(
        `coinbase.com/${kind}`,
        (await detail(f)).map(data => ({ id: data.id, data })),
      );
    }
  } finally {
    await bk.close();
  }
}

if (require.main === module) {
  main(process.argv.slice(2), {
    env: process.env,
    https: require('https'),
    mysql: require('mysql'),
    clock: () => new Date(),
    setTimeout,
    require,
  }).catch(err => {
    console.error(err);
  });
}
