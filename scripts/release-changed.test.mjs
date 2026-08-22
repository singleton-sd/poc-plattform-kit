import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { RELEASE_BRANCH } from './release-changed.mjs';

const workflowUrl = new URL('../.github/workflows/release.yml', import.meta.url);
const scriptUrl = new URL('./release-changed.mjs', import.meta.url);

test('RELEASE_BRANCH is the ephemeral chore branch used by release.yml', () => {
  assert.equal(RELEASE_BRANCH, 'chore/release-package-versions');
});

test('release-changed.mjs documents PR merge flow instead of direct main push', async () => {
  const script = await readFile(scriptUrl, 'utf8');
  assert.doesNotMatch(script, /HEAD:main/);
  assert.match(script, /pushReleaseBranch/);
  assert.match(script, /--push-tags/);
});

test('release.yml merges the release branch PR and pushes tags after merge', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');
  assert.match(workflow, /Merge release PR/);
  assert.match(workflow, /Push release tags/);
  assert.match(workflow, /chore\/release-package-versions/);
  assert.match(workflow, /pull-requests: write/);
  assert.match(workflow, /Release branch pushed:/);
  assert.match(workflow, /--push-tags/);
});
