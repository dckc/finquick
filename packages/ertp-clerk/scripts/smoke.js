import { newWebSocketRpcSession } from 'capnweb';

const baseUrl = process.env.ERTP_CLERK_URL ?? 'http://localhost:8787';
const apiUrl = new URL('/api', baseUrl);
apiUrl.protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
const socket = new WebSocket(apiUrl);
const api = newWebSocketRpcSession(socket);
const kit = await api.makeIssuerKit('BUCKS');
const name = await kit.brand.getAllegedName();
const alice = await kit.issuer.makeEmptyPurse();
const bob = await kit.issuer.makeEmptyPurse();
const amount = { brand: kit.brand, value: 10n };
const payment = await kit.mint.mintPayment(amount);
await alice.deposit(payment);
const paymentToBob = await alice.withdraw(amount);
await bob.deposit(paymentToBob);
const aliceAmount = await alice.getCurrentAmount();
const bobAmount = await bob.getCurrentAmount();

console.log('issuer kit brand:', name);
console.log('alice amount:', aliceAmount);
console.log('bob amount:', bobAmount);
socket.close();
await new Promise((resolve) => socket.addEventListener('close', resolve, { once: true }));
