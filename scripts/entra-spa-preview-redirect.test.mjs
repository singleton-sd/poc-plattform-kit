import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addRedirectUri,
  buildSwaPrPreviewOrigin,
  normalizeOrigin,
  removeRedirectUri,
} from './entra-spa-preview-redirect.mjs';

test('buildSwaPrPreviewOrigin matches kind-rock PR hosts', () => {
  assert.equal(
    buildSwaPrPreviewOrigin('kind-rock-0f409fe00.7.azurestaticapps.net', 90),
    'https://kind-rock-0f409fe00-90.eastasia.7.azurestaticapps.net',
  );
  assert.equal(
    buildSwaPrPreviewOrigin('https://kind-rock-0f409fe00.7.azurestaticapps.net/', '84', 'eastasia'),
    'https://kind-rock-0f409fe00-84.eastasia.7.azurestaticapps.net',
  );
});

test('buildSwaPrPreviewOrigin rejects bad input', () => {
  assert.throws(() => buildSwaPrPreviewOrigin('', 1));
  assert.throws(() => buildSwaPrPreviewOrigin('host.example', 'x'));
});

test('normalizeOrigin strips path and trailing slash', () => {
  assert.equal(
    normalizeOrigin('https://kind-rock-0f409fe00-90.eastasia.7.azurestaticapps.net/'),
    'https://kind-rock-0f409fe00-90.eastasia.7.azurestaticapps.net',
  );
  assert.equal(
    normalizeOrigin('kind-rock-0f409fe00-90.eastasia.7.azurestaticapps.net/login'),
    'https://kind-rock-0f409fe00-90.eastasia.7.azurestaticapps.net',
  );
});

test('addRedirectUri is idempotent', () => {
  const origin = 'https://kind-rock-0f409fe00-90.eastasia.7.azurestaticapps.net';
  const once = addRedirectUri(['http://localhost:3000'], origin);
  const twice = addRedirectUri(once, origin + '/');
  assert.deepEqual(twice, ['http://localhost:3000', origin]);
});

test('removeRedirectUri drops exact origin only', () => {
  const origin = 'https://kind-rock-0f409fe00-90.eastasia.7.azurestaticapps.net';
  const next = removeRedirectUri(
    ['http://localhost:3000', origin, 'https://kind-rock-0f409fe00.7.azurestaticapps.net'],
    origin + '/',
  );
  assert.deepEqual(next, [
    'http://localhost:3000',
    'https://kind-rock-0f409fe00.7.azurestaticapps.net',
  ]);
});
