import test from 'ava';
import Database from 'better-sqlite3';
import type {
  AssetKind,
  Brand,
  Issuer,
  Mint,
  Payment,
} from '../../ertp-ledgerguise/src/ertp-types.js';
import {
  asGuid,
  createIssuerKit,
  initGnuCashSchema,
  wrapBetterSqlite3Database,
} from '../../ertp-ledgerguise/src/index.js';
import { type Depiction, makeLedgerCodec } from '../src/ledger-codec.js';
import { decodeClientValue, encodeClientValue } from '../src/webkey-codec.js';

const { freeze } = Object;

const refCodec = {
  makeRef: (token: string) => `cap:${token}`,
  parseRef: (ref: string) => {
    if (!ref.startsWith('cap:')) throw new Error('bad ref');
    return ref.slice('cap:'.length);
  },
};

const db = wrapBetterSqlite3Database(new Database(':memory:'));
initGnuCashSchema(db, { allowTransactionStatements: false });

type MethodRecord = Record<string, (...args: unknown[]) => unknown>;

const logged = <T>(label: string, x: T) => {
  console.log('@@', label, x);
  return x;
};

const makeClientContext = (svc: DoWorker) => {
  const proxies = new Map<string, object>();
  const proxyToKey = new WeakMap<object, string>();

  const mkProxy = (webkey: string | undefined) => {
    const ref = webkey ? freeze({ '@': webkey }) : undefined;
    const target = freeze({ isProxy: true, ...(webkey ? { webkey } : {}) });
    const proxy = new Proxy(target, {
      get(obj, property, _rx) {
        if (typeof property === 'symbol') return undefined;
        const method = property as string;
        if (method === 'then') return undefined;
        if (Object.prototype.hasOwnProperty.call(obj, method)) {
          return (obj as Record<string, unknown>)[method];
        }
        return (...args: unknown[]) =>
          svc
            .fetch(
              ref,
              method,
              args.map(a => encodeClientArg(a)),
            )
            .then(w => decode(w));
      },
    });
    if (webkey) proxyToKey.set(proxy, webkey);
    return proxy;
  };

  const isProxyRef = (value: unknown) => {
    if (!value || typeof value !== 'object') return false;
    const key = proxyToKey.get(value as object);
    return !!key && proxies.has(key);
  };

  const encodeClientArg = (value: unknown): Depiction =>
    encodeClientValue(value, {
      getProxyRef: v => {
        if (!isProxyRef(v)) return undefined;
        return proxyToKey.get(v as object);
      },
    });
  const keyToProxy = (webkey: string) => {
    const known = proxies.get(webkey);
    if (known) return known;
    const proxy = mkProxy(webkey);
    proxies.set(webkey, proxy);
    return proxy;
  };

  const decode = (value: Depiction) => decodeClientValue(value, keyToProxy);

  const root = () => mkProxy(undefined) as unknown as Remote<DoActor>;

  return freeze({ decode, root });
};

const makeDoActor = () => {
  const codec = makeLedgerCodec({
    db,
    nowMs: () => Date.now(),
    makeGuid: () => asGuid(crypto.randomUUID().replace(/-/g, '')),
    makeToken: () => crypto.randomUUID().replace(/-/g, ''),
    refCodec,
  });
  const self = {
    makeIssuerKit: (mnemonic: string) => {
      const kit = createIssuerKit({
        db,
        commodity: { namespace: 'COMMODITY', mnemonic },
        makeGuid: () => asGuid(crypto.randomUUID().replace(/-/g, '')),
        nowMs: () => Date.now(),
      });
      codec.registerKit(kit);
      return { mint: kit.mint, issuer: kit.issuer, brand: kit.brand };
    },
  };
  const fetch = async (
    receiver: Depiction | undefined,
    method: string,
    args: Depiction[],
  ) => {
    const rx = (receiver ? codec.build(receiver) : self) as MethodRecord;
    const params = args.map(a => codec.build(a));
    const result = rx[method](...params);
    return codec.recognize(result);
  };
  return freeze({ self, worker: freeze({ fetch }) });
};
type DoWorkerKit = ReturnType<typeof makeDoActor>;
type DoActor = DoWorkerKit['self'];
type DoWorker = DoWorkerKit['worker'];
type NatPayment = Payment<'nat'>;
type AnyPayment = Payment<AssetKind>;

type RemoteResult<T> = T extends object ? Remote<T> : T;

type Remote<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<RemoteResult<R>>
    : never;
};

type RemoteKit = {
  mint: Remote<Mint<'nat'>>;
  issuer: Remote<Issuer<'nat'>>;
  brand: Brand<'nat'>;
};

type IssuerService = {
  makeIssuerKit: (mnemonic: string) => Promise<RemoteKit>;
};

const makeAlice = (svc: IssuerService) => ({
  run: async () => {
    const kit = await svc.makeIssuerKit('BUCKS');
    const purse = await kit.issuer.makeEmptyPurse();
    const zillion = await kit.mint.mintPayment({
      brand: kit.brand,
      value: 1_000_000n,
    });
    await purse.deposit(zillion as unknown as NatPayment);
    const payment10 = await purse.withdraw({
      brand: kit.brand,
      value: 10n,
    });
    return { issuer: kit.issuer, payment: payment10 };
  },
});

const makeBob = (issuer: Remote<Issuer>, payment: Remote<NatPayment>) => ({
  run: async () => {
    const purse = await issuer.makeEmptyPurse();
    await purse.deposit(payment as unknown as AnyPayment);
    return purse.getCurrentAmount();
  },
});

test('ledger codec round-trips bigints', t => {
  const { recognize, build } = makeLedgerCodec({
    db,
    nowMs: () => Date.now(),
    makeGuid: () => asGuid(crypto.randomUUID().replace(/-/g, '')),
    makeToken: () => crypto.randomUUID().replace(/-/g, ''),
    refCodec,
  });

  const encoded = recognize({ n: 1, b: 2n, arr: [3n, 'ok'] });
  t.deepEqual(encoded, { n: 1, b: { '+': '2' }, arr: [{ '+': '3' }, 'ok'] });
  t.deepEqual(build(encoded), { n: 1, b: 2n, arr: [3n, 'ok'] });
});

test('ledger codec integrates openIssuerKit', async t => {
  let tokenCounter = 0;
  const kit = createIssuerKit({
    db,
    commodity: { namespace: 'COMMODITY', mnemonic: 'BUCKS' },
    makeGuid: () => asGuid(crypto.randomUUID().replace(/-/g, '')),
    nowMs: () => Date.now(),
  });
  const purse = kit.issuer.makeEmptyPurse();
  const depositFacet = purse.getDepositFacet();
  const seedPayment = kit.mint.mintPayment({ brand: kit.brand, value: 5n });
  purse.deposit(seedPayment);
  const payment = purse.withdraw({ brand: kit.brand, value: 5n });

  const codec = makeLedgerCodec({
    db,
    nowMs: () => Date.now(),
    makeGuid: () => asGuid(crypto.randomUUID().replace(/-/g, '')),
    makeToken: () => `tok${(tokenCounter += 1)}`,
    refCodec,
  });
  codec.registerKit(kit);

  const mintRef = codec.recognize(kit.mint);
  const issuerRef = codec.recognize(kit.issuer);
  const purseRef = codec.recognize(purse);
  const paymentRef = codec.recognize(payment);
  const depositRef = codec.recognize(depositFacet);

  t.deepEqual(mintRef, { '@': 'cap:tok1' });
  t.deepEqual(issuerRef, { '@': 'cap:tok2' });
  t.deepEqual(purseRef, { '@': 'cap:tok3' });
  t.deepEqual(paymentRef, { '@': 'cap:tok4' });
  t.deepEqual(depositRef, { '@': 'cap:tok5' });

  const issuer2 = codec.build(issuerRef) as typeof kit.issuer;
  const purse2 = codec.build(purseRef) as typeof purse;
  const payment2 = codec.build(paymentRef) as typeof payment;
  const deposit2 = codec.build(depositRef) as typeof depositFacet;

  const issuer3 = codec.build(issuerRef) as typeof kit.issuer;
  const payment3 = codec.build(paymentRef) as typeof payment;

  t.is(issuer2, kit.issuer, 'build(issuerRef) preserves issuer identity');
  t.is(issuer3, kit.issuer, 'build(issuerRef) preserves issuer identity');
  t.is(payment2, payment, 'build(paymentRef) preserves payment identity');
  t.is(payment3, payment, 'build(paymentRef) preserves payment identity');
  const brand2 = await issuer2.getBrand();
  t.is(
    await brand2.getAllegedName(),
    await kit.brand.getAllegedName(),
    'brand alleged name round-trips',
  );
  const balance2 = await purse2.getCurrentAmount();
  t.is(balance2.value, 0n, 'withdrawal drains purse');
  t.true(await brand2.isMyIssuer(issuer2), 'brand recognizes issuer');
  t.true(
    await (
      issuer2 as unknown as { isLive: (p: unknown) => Promise<boolean> }
    ).isLive(payment2),
    'issuer reports payment live',
  );
  t.is(
    typeof (deposit2 as { receive: (p: object) => unknown }).receive,
    'function',
    'deposit facet has receive method',
  );
});

test('ledger codec supports actor-style restart flow', async t => {
  const do1 = makeDoActor();
  const aliceClient = makeClientContext(do1.worker);
  const alice = makeAlice({
    makeIssuerKit: (name: string) => aliceClient.root().makeIssuerKit(name),
  });
  const outA = await alice.run();
  const wireA = encodeClientValue(outA);

  const do2 = makeDoActor();
  const bobClient = makeClientContext(do2.worker);
  const bobRxd = bobClient.decode(wireA) as any;
  const bob = makeBob(bobRxd.issuer, bobRxd.payment);
  const balance = bobClient.decode(await bob.run()) as any;
  t.is(balance.value, 10n, 'bob receives 10 BUCKS');
});
