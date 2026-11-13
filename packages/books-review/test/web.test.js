/**
 * @file The app socket's route and its `/api`, without a toybox: a key
 * designates an object, and a call is a method call on it.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { E, Far } from '@endo/far';
import { makeApi } from '../boot/boot/api.js';
import { ok, respond } from '../boot/boot/http.js';

const files = harden({ '/': ok('text/html', '<p>hi') });
const echo = Far('echo', { echo: (/** @type {unknown[]} */ ...xs) => xs });
/** @param {unknown} key */
const designates = key => (key === 'k1' ? echo : undefined);
const handle = respond({ files, api: makeApi(E, designates) });

/** @param {unknown} request */
const call = async request => {
  const { status, body } = await handle({
    method: 'POST',
    path: '/api',
    labels: {},
    body: JSON.stringify(request),
  });
  return { status, body: JSON.parse(body ?? '') };
};

test('a GET answers a file, or not found; a POST to /api goes to the key it names', async () => {
  const get = (/** @type {string} */ path) =>
    handle({ method: 'GET', path, labels: {}, body: '' });
  assert.equal(await get('/'), files['/']);
  assert.equal((await get('/nope')).status, 404);
  assert.equal((await get('/api')).status, 404);

  assert.deepEqual(await call({ key: 'k1', op: 'echo', args: [1, 'a'] }), {
    status: 200,
    body: [1, 'a'],
  });
  assert.deepEqual(await call({ key: 'guess', op: 'echo' }), {
    status: 403,
    body: { error: 'that key opens nothing here' },
  });
  assert.equal((await call({ key: 'k1', op: 'nope' })).status, 400);
  assert.equal(
    (await call({ key: 'k1', op: 'echo', args: 'x' })).status,
    400,
    'args are a list',
  );
  const bad = await handle({
    method: 'POST',
    path: '/api',
    labels: {},
    body: '{',
  });
  assert.equal(bad.status, 400);
});
