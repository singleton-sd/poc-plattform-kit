import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  addRedirectUri,
  buildSwaPrPreviewOrigin,
  normalizeOrigin,
  removeRedirectUri,
} from './entra-spa-preview-redirect.mjs';

const workflowUrl = new URL('../.github/workflows/preview-web.yml', import.meta.url);

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

test('credentialed redirect jobs use only the trusted base helper', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');
  const credentialedJobs = workflow.slice(workflow.indexOf('  register_entra_redirect:'));

  assert.equal(
    (credentialedJobs.match(/ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/g) ?? [])
      .length,
    2,
  );
  assert.equal((credentialedJobs.match(/sparse-checkout-cone-mode: false/g) ?? []).length, 2);

  for (const job of ['register_entra_redirect', 'close_preview']) {
    const start = credentialedJobs.indexOf(`  ${job}:`);
    const nextJob = credentialedJobs.indexOf('\n  close_preview:', start + 3);
    const definition = credentialedJobs.slice(
      start,
      job === 'register_entra_redirect' ? nextJob : undefined,
    );
    assert.ok(
      definition.indexOf('Check out trusted redirect helper') <
        definition.indexOf('Azure login (OIDC)'),
    );
  }
});

test('all redirect mutations share a non-cancelling concurrency group', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');
  const credentialedJobs = workflow.slice(workflow.indexOf('  register_entra_redirect:'));

  assert.equal((credentialedJobs.match(/group: entra-spa-preview-redirects/g) ?? []).length, 2);
  assert.equal((credentialedJobs.match(/cancel-in-progress: false/g) ?? []).length, 2);
});
