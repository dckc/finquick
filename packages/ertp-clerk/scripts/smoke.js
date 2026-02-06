import { makeClient } from '../src/webkey-client.js';

const baseUrl = process.env.ERTP_CLERK_URL ?? 'http://localhost:8787';
const apiUrl = new URL('/api', baseUrl);
const bootstrapUrl = new URL('/bootstrap', baseUrl);
bootstrapUrl.searchParams.set('format', 'json');

const { webkey } = await fetch(bootstrapUrl).then((res) => res.json());
const client = makeClient(apiUrl);
const bootstrap = client.keyToProxy(webkey);
const { issuer, brand, payment: pmt1 } = await (async () => {
  const kit = await bootstrap.makeIssuerKit('BUCKS');
  const amount = { brand: kit.brand, value: 10n };
  const payment = await kit.mint.mintPayment(amount);
  return { issuer: kit.issuer, brand: kit.brand, payment };
})();

const makeParty = async (issuer, name, counterpartyDepositFacet = null) => {
  const purse = await issuer.makeEmptyPurse();
  return Object.freeze({
    name,
    getDepositFacet: () => purse.getDepositFacet(),
    getBalance: () => purse.getCurrentAmount(),
    deposit: (payment) => purse.deposit(payment),
    payCounterparty: async (amount) => {
      if (!counterpartyDepositFacet) {
        throw new Error('no counterparty deposit facet configured');
      }
      const payment = await purse.withdraw(amount);
      return counterpartyDepositFacet.receive(payment);
    },
  });
};

const amount = { brand, value: 10n };
const bob = await makeParty(issuer, 'Bob');
const bobDeposit = await bob.getDepositFacet();
const alice = await makeParty(issuer, 'Alice', bobDeposit);

await alice.deposit(pmt1);

await alice.payCounterparty(amount);

const aliceAmount = await alice.getBalance();
const bobAmount = await bob.getBalance();
const name = await brand.getAllegedName();

console.log('issuer kit brand:', name);
console.log('alice amount:', aliceAmount);
console.log('bob amount:', bobAmount);
