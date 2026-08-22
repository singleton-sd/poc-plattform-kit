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
  assert.doesNotMatch(script, /chore\/release-package-versions/);
  assert.doesNotMatch(script, /--push-tags/);
});

test('release.yml loads org platform automation PAT from devtools Key Vault', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');
  assert.doesNotMatch(workflow, /Merge release PR/);
  assert.doesNotMatch(workflow, /chore\/release-package-versions/);
  assert.match(workflow, /Release commit and tags pushed/);
  assert.match(workflow, /SSD_OPS_KEY_VAULT_NAME/);
  assert.match(workflow, /ssd-devtools-kv-prod-ae/);
  assert.match(workflow, /github-automation-pat/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /pat_file/);
  assert.match(workflow, /trap cleanup EXIT/);
  assert.doesNotMatch(workflow, /GITHUB_AUTOMATION_TOKEN=\$pat/);
  assert.doesNotMatch(workflow, /token: \$\{\{ env\.GITHUB_AUTOMATION_TOKEN \}\}/);
});

test('SETUP documents devtools vault, PAT permissions, and copy-paste setup', async () => {
  const setup = await readFile(setupUrl, 'utf8');
  assert.match(setup, /ssd-devtools-kv-prod-ae/);
  assert.match(setup, /github-automation-pat/);
  assert.match(setup, /Contents.*Read and write/i);
  assert.match(setup, /Metadata.*Read/i);
  assert.match(setup, /copy-paste/i);
});
