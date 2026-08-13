import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  addRedirectUri,
  buildSwaPrPreviewOrigin,
  normalizeOrigin,
  parseAcaWebPrPreviewOrigin,
  parseSwaPrPreviewOrigin,
  removeRedirectUri,
  sweepSpaPrPreviewRedirects,
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

test('parseSwaPrPreviewOrigin extracts PR from preview host', () => {
  assert.deepEqual(
    parseSwaPrPreviewOrigin('https://kind-rock-0f409fe00-90.eastasia.7.azurestaticapps.net/'),
    { unique: 'kind-rock-0f409fe00', pr: '90', region: 'eastasia' },
  );
  assert.equal(parseSwaPrPreviewOrigin('https://kind-rock-0f409fe00.7.azurestaticapps.net'), null);
  assert.equal(parseSwaPrPreviewOrigin('http://localhost:3000'), null);
});

const acaWebOrigin =
  'https://ssd-pocpk-aca-web-pr-190-ae.victoriouscliff-509c369b.australiaeast.azurecontainerapps.io';
const acaApiOrigin =
  'https://ssd-pocpk-aca-pr-190-ae.victoriouscliff-509c369b.australiaeast.azurecontainerapps.io';

test('parseAcaWebPrPreviewOrigin extracts PR from web ACA host', () => {
  assert.deepEqual(parseAcaWebPrPreviewOrigin(acaWebOrigin + '/'), {
    pr: '190',
    hash: 'victoriouscliff-509c369b',
  });
  assert.equal(parseAcaWebPrPreviewOrigin(acaApiOrigin), null);
  assert.equal(parseSwaPrPreviewOrigin(acaWebOrigin), null);
});

test('addRedirectUri accepts ACA web origins and rejects API ACA hosts', () => {
  const once = addRedirectUri(['http://localhost:3000'], acaWebOrigin + '/');
  assert.deepEqual(once, ['http://localhost:3000', acaWebOrigin]);
  assert.throws(() => addRedirectUri([], acaApiOrigin));
});

test('removeRedirectUri drops an explicit ACA web origin', () => {
  const next = removeRedirectUri(['http://localhost:3000', acaWebOrigin], acaWebOrigin + '/');
  assert.deepEqual(next, ['http://localhost:3000']);
});

test('sweepSpaPrPreviewRedirects drops closed PR previews only', () => {
  const prod = 'https://kind-rock-0f409fe00.7.azurestaticapps.net';
  const open = 'https://kind-rock-0f409fe00-95.eastasia.7.azurestaticapps.net';
  const closed = 'https://kind-rock-0f409fe00-44.eastasia.7.azurestaticapps.net';
  const plan = sweepSpaPrPreviewRedirects(
    ['http://localhost:3000', prod, open, closed],
    [95, 97],
    'eastasia',
  );
  assert.deepEqual(plan.remove, [closed]);
  assert.deepEqual(plan.keep, [open]);
  assert.deepEqual(plan.next, ['http://localhost:3000', prod, open]);
});

test('sweepSpaPrPreviewRedirects drops closed ACA web origins', () => {
  const openAca =
    'https://ssd-pocpk-aca-web-pr-95-ae.victoriouscliff-509c369b.australiaeast.azurecontainerapps.io';
  const closedAca =
    'https://ssd-pocpk-aca-web-pr-44-ae.victoriouscliff-509c369b.australiaeast.azurecontainerapps.io';
  const apiAca =
    'https://ssd-pocpk-aca-pr-44-ae.victoriouscliff-509c369b.australiaeast.azurecontainerapps.io';
  const plan = sweepSpaPrPreviewRedirects(
    ['http://localhost:3000', openAca, closedAca, apiAca],
    [95, 97],
    'eastasia',
  );
  assert.deepEqual(plan.remove, [closedAca]);
  assert.deepEqual(plan.keep, [openAca]);
  assert.deepEqual(plan.next, ['http://localhost:3000', openAca, apiAca]);
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

test('register_entra_redirect serializes Entra mutations', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');
  const credentialedJobs = workflow.slice(workflow.indexOf('  register_entra_redirect:'));
  const register = credentialedJobs.slice(0, credentialedJobs.indexOf('\n  close_preview:'));

  assert.equal((register.match(/group: entra-spa-preview-redirects/g) ?? []).length, 1);
  assert.match(register, /cancel-in-progress: false/);
});

test('close_preview shares deploy concurrency so close cancels in-flight deploy', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');
  assert.match(
    workflow,
    /build_and_preview:[\s\S]*group: preview-web-\$\{\{ github\.event\.pull_request\.number \}\}/,
  );
  const close = workflow.slice(workflow.indexOf('  close_preview:'));
  assert.match(close, /group: preview-web-\$\{\{ github\.event\.pull_request\.number \}\}/);
  assert.match(close, /cancel-in-progress: true/);
});
