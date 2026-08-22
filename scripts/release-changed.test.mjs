import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowUrl = new URL('../.github/workflows/release.yml', import.meta.url);
const scriptUrl = new URL('./release-changed.mjs', import.meta.url);
const setupUrl = new URL('../SETUP.md', import.meta.url);

test('release-changed.mjs pushes main directly (ruleset bypass, not a release PR)', async () => {
  const script = await readFile(scriptUrl, 'utf8');
  assert.match(script, /HEAD:main/);
  assert.match(script, /pushReleaseCommit/);
  assert.doesNotMatch(script, /chore\/release-package-versions/);
  assert.doesNotMatch(script, /--push-tags/);
});

test('release.yml does not open a release PR', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');
  assert.doesNotMatch(workflow, /Merge release PR/);
  assert.doesNotMatch(workflow, /chore\/release-package-versions/);
  assert.match(workflow, /Release commit and tags pushed/);
});

test('SETUP documents GitHub Actions ruleset bypass for release', async () => {
  const setup = await readFile(setupUrl, 'utf8');
  assert.match(setup, /15368/);
  assert.match(setup, /bypass_mode.*always/i);
});
