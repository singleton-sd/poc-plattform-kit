import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowUrl = new URL('../.github/workflows/release.yml', import.meta.url);
const scriptUrl = new URL('./release-changed.mjs', import.meta.url);
const setupUrl = new URL('../SETUP.md', import.meta.url);

test('release-changed.mjs pushes main directly (not a release PR)', async () => {
  const script = await readFile(scriptUrl, 'utf8');
  assert.match(script, /HEAD:main/);
  assert.match(script, /pushReleaseCommit/);
  assert.match(script, /\[skip ci\]/);
  assert.match(script, /RELEASE_TAGS=/);
  assert.match(script, /const gitEnv = \{\s*\.\.\.process\.env,\s*HUSKY: '0'\s*\};/);
  assert.match(script, /push', 'origin', 'HEAD:main'\], \{ env: gitEnv \}\)/);
  assert.match(script, /push', 'origin', \.\.\.tags\], \{ env: gitEnv \}\)/);
  assert.doesNotMatch(script, /chore\/release-package-versions/);
  assert.doesNotMatch(script, /--push-tags/);
});

test('release.yml loads org platform automation PAT from devtools Key Vault', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');
  assert.doesNotMatch(workflow, /Merge release PR/);
  assert.doesNotMatch(workflow, /chore\/release-package-versions/);
  assert.match(workflow, /Release commit and tags pushed/);
  assert.match(workflow, /github\.actor != 'github-actions\[bot\]'/);
  assert.match(workflow, /\[skip ci\]/);
  assert.match(workflow, /Publish GitHub releases/);
  assert.match(workflow, /gh release create/);
  assert.match(workflow, /RELEASE_TAGS=/);
  assert.match(workflow, /SSD_OPS_KEY_VAULT_NAME/);
  assert.match(workflow, /ssd-devtools-kv-prod-ae/);
  assert.match(workflow, /github-automation-pat/);
  assert.match(workflow, /vault\.azure\.net/);
  assert.doesNotMatch(workflow, /az keyvault secret show[\s\S]*SSD_OPS_KEY_VAULT_SUBSCRIPTION_ID/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /pat_file/);
  assert.match(workflow, /trap cleanup EXIT/);
  assert.doesNotMatch(workflow, /Dispatch production deploys/);
  assert.doesNotMatch(workflow, /gh workflow run deploy-api/);
  assert.doesNotMatch(workflow, /GITHUB_AUTOMATION_TOKEN=\$pat/);
  assert.doesNotMatch(workflow, /token: \$\{\{ env\.GITHUB_AUTOMATION_TOKEN \}\}/);
});

test('production deploy workflows trigger on package tags', async () => {
  const deployApi = await readFile(
    new URL('../.github/workflows/deploy-api.yml', import.meta.url),
    'utf8',
  );
  const deployWeb = await readFile(
    new URL('../.github/workflows/deploy-web.yml', import.meta.url),
    'utf8',
  );
  const deployMarketing = await readFile(
    new URL('../.github/workflows/deploy-marketing.yml', import.meta.url),
    'utf8',
  );
  assert.match(deployApi, /'@poc-plattform-kit\/api@\*'/);
  assert.match(deployWeb, /'@poc-plattform-kit\/web@\*'/);
  assert.match(deployMarketing, /'@poc-plattform-kit\/marketing@\*'/);
  assert.doesNotMatch(deployApi, /branches: \[main\]/);
  assert.doesNotMatch(deployWeb, /branches: \[main\]/);
});

test('SETUP documents devtools vault, PAT permissions, and copy-paste setup', async () => {
  const setup = await readFile(setupUrl, 'utf8');
  assert.match(setup, /ssd-devtools-kv-prod-ae/);
  assert.match(setup, /github-automation-pat/);
  assert.match(setup, /Contents.*Read and write/i);
  assert.match(setup, /Metadata.*Read/i);
  assert.match(setup, /copy-paste/i);
});

test('production deploy workflows disable checkout credential persistence', async () => {
  for (const name of ['deploy-api.yml', 'deploy-web.yml', 'deploy-marketing.yml']) {
    const workflow = await readFile(
      new URL(`../.github/workflows/${name}`, import.meta.url),
      'utf8',
    );
    assert.match(workflow, /persist-credentials: false/);
  }
});
