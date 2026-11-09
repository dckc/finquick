/**
 * @file The app socket's route, without a toybox: a GET answers a file, or
 * not found.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ok, respond } from '../boot/boot/http.js';

const files = harden({ '/': ok('text/html', '<p>hi') });
const handle = respond({ files });

test('a GET answers a file, or not found', () => {
  const get = (/** @type {string} */ path) =>
    handle({ method: 'GET', path, labels: {}, body: '' });
  assert.equal(get('/'), files['/']);
  assert.equal(get('/nope').status, 404);
  assert.equal(
    handle({ method: 'POST', path: '/', labels: {}, body: '' }).status,
    404,
  );
});
