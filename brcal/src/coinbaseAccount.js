// @ts-check
import { createHmac } from 'crypto';

import { WebApp } from './WebApp';
import { check, logged } from './check';

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
  /** @param {bs} Bytes */
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
 * @typedef {ReturnType<import('./WebApp').WebApp>} WebApp
 */
function makeCoinbase(endPoint, clock, api) {
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
      await endPoint
        .pathjoin(path)
        .withHeaders(Coinbase.fmtSig(api.key, sig, ts))
        .get(),
    );
  }

  async function paged(result) {
    if (!result.data) {
      console.log('@@@', result);
      return [];
    }
    let data = check.notNull(result.data);
    let path;
    while ((path = result.pagination.next_uri)) {
      result = await getJSON(path);
      if (!result.data) {
        console.log('@@@', result);
        throw Error('@@@');
      }
      data = [...data, ...check.notNull(result.data)];
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

    function sells() {
      return paged(getJSON(`/v2/accounts/${id}/sells`));
    }

    async function transactions() {
      const result = await getJSON(`/v2/accounts/${id}/transactions`);
      assert(
        !result.errors,
        `cannot list transactions: ${JSON.stringify(result.errors)}`,
      );
      return paged(result);
    }
    return freeze({ list, transactions, sells });
  }

  async function time() {
    return JSON.parse(await endPoint.pathjoin('time').get());
  }

  return freeze({ time, accounts });
}

function makeCoinbasePro(web, clock, api) {
  const base = {
    origin: 'https://api.pro.coinbase.com',
    url: 'https://api.pro.coinbase.com/',
    path: '/',
  };

  function fmtSig(signature, timestamp) {
    return {
      'CB-ACCESS-KEY': api.key,
      'CB-ACCESS-SIGN': Base64.encode(signature),
      'CB-ACCESS-TIMESTAMP': timestamp,
      'CB-ACCESS-PASSPHRASE': api.passPhrase,
    };
  }

  const cc = coinbaseCommon(
    web,
    clock,
    base,
    Base64.decode(api.secret),
    fmtSig,
  );

  function orders(status) {
    function list() {
      // TODO: paged
      return cc.getJSON(base.path + 'orders?status=' + status);
    }

    // {"id":"9bd30e61-de96-4a25-9c38-5b110d13a03d",
    //  "price":"6559.90000000","size":"0.00250999","product_id":"BTC-USD","side":"sell","type":"limit",
    //  "time_in_force":"GTC","post_only":true,"created_at":"2018-10-08T05:04:45.364184Z","done_at":"2018-10-08T10:45:29.401Z",
    //  "done_reason":"filled","fill_fees":"0.0000000000000000","filled_size":"0.00250999","executed_value":"16.4652834010000000",
    //  "status":"done","settled":true}
    function unpack(txData) {
      const hd = [
        'id',
        'done_at',
        'product_id',
        'price',
        'size',
        'executed_value',
        'fill_fees',
        'status',
        'side',
        'type',
        'created_at',
      ];
      const rows = txData.map(function(tx) {
        tx.done_at = (tx.done_at || '').replace('T', ' ').replace('Z', '');
        tx.created_at = (tx.created_at || '')
          .replace('T', ' ')
          .replace('Z', '');
        tx.price = tx.price || null;
        return hd.map(function(k) {
          return tx[k];
        });
      });
      return { hd: hd, rows: rows };
    }
    return freeze({ list: list, unpack: unpack });
  }

  function fills(productId) {
    function list() {
      // TODO: paged
      return cc.getJSON(base.path + 'fills?product_id=' + productId);
    }

    // {"created_at":"2018-08-03T15:36:17.9Z","trade_id":38221286,"product_id":"ETH-USD",
    // "order_id":"195c5aef-bbeb-4014-9ab8-5e62f2b20a06","user_id":"573a7c2b66084b3114000412",
    // "profile_id":"8934d7bf-413e-4179-bc52-2e6831e91fab","liquidity":"M","price":"413.35000000",
    // "size":"0.11745726","fee":"0.0000000000000000","side":"sell","settled":true,"usd_volume":"48.5509584210000000"}
    function unpack(txData) {
      const hd = [
        'trade_id',
        'created_at',
        'price',
        'size',
        'usd_volume',
        'fee',
        'liquidity',
        'side',
        'settled',
        'order_id',
      ];
      const rows = txData.map(function(tx) {
        tx.created_at = tx.created_at.replace('T', ' ').replace('Z', '');
        return hd.map(function(k) {
          return tx[k];
        });
      });
      return { hd: hd, rows: rows };
    }
    return freeze({ list, unpack });
  }
  return freeze({ fills, orders });
}

/**
 * @param {string[]} args
 * @param {{
 *   env: typeof process.env,
 *   stdout: typeof process.stdout,
 *   clock: () => Date,
 *   https: typeof import('https'),
 * }} io
 */
async function main(args, { env, stdout, clock, https }) {
  const cb = makeCoinbase(WebApp(Coinbase.origin, { https }), clock, {
    key: check.notNull(env.COINBASE_KEY),
    secret: UTF8.encode(check.notNull(env.COINBASE_SECRET)),
  });

  if (args.includes('--time')) {
    console.log(await cb.time());
    console.log(clock());
    return;
  }
  if (args.includes('--test')) {
    testSig();
    return;
  }

  const accounts = await cb.accounts().list();

  const transactions = await Promise.all(
    accounts.map(account => cb.accounts(account.id).transactions()),
  );
  stdout.write(JSON.stringify({ accounts, transactions }, null, 2));
}

if (require.main === module) {
  main(process.argv.slice(2), {
    env: process.env,
    stdout: process.stdout,
    https: require('https'),
    clock: () => new Date(),
  }).catch(err => {
    console.error(err);
  });
}
