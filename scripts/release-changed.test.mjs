import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  collectTagsToReconcile,
  deriveIncrement,
  nextVersion,
  resolveNextVersion,
  versionFromTag,
  watchPathsFor,
} from './release-changed.mjs';

const workflowUrl = new URL('../.github/workflows/release.yml', import.meta.url);
const scriptUrl = new URL('./release-changed.mjs', import.meta.url);
const setupUrl = new URL('../SETUP.md', import.meta.url);

test('deriveIncrement maps conventional commits to semver bumps', () => {
  assert.equal(deriveIncrement(['fix: patch the parser']), 'patch');
  assert.equal(deriveIncrement(['perf: speed up list']), 'patch');
  assert.equal(deriveIncrement(['feat: add dark mode']), 'minor');
  assert.equal(deriveIncrement(['feat(api): add webhook']), 'minor');
  assert.equal(deriveIncrement(['feat!: drop legacy route']), 'major');
  assert.equal(
    deriveIncrement(['feat: add option\n\nBREAKING CHANGE: new required field']),
    'major',
  );
  assert.equal(deriveIncrement(['chore: Release package versions [skip ci]']), null);
  assert.equal(deriveIncrement(['docs: update readme']), null);
  assert.equal(deriveIncrement(['fix: a', 'feat: b']), 'minor');
});

test('nextVersion increments from the tag baseline', () => {
  assert.equal(nextVersion('0.25.0', 'patch'), '0.25.1');
  assert.equal(nextVersion('0.25.0', 'minor'), '0.26.0');
  assert.equal(nextVersion('0.25.0', 'major'), '1.0.0');
  assert.equal(nextVersion('not-a-version', 'patch'), '0.0.1');
});

test('versionFromTag parses @scope/name@version tags only', () => {
  assert.equal(versionFromTag('@poc-plattform-kit/api', '@poc-plattform-kit/api@0.25.0'), '0.25.0');
  assert.equal(versionFromTag('@poc-plattform-kit/api', '@poc-plattform-kit/web@0.17.0'), null);
  assert.equal(versionFromTag('@poc-plattform-kit/api', '@poc-plattform-kit/api@nope'), null);
  assert.equal(versionFromTag('@poc-plattform-kit/api', null), null);
});

test('resolveNextVersion uses the git tag, not a stale package.json', () => {
  const exists = () => false;
  const fromTag = resolveNextVersion(
    '@poc-plattform-kit/api',
    '@poc-plattform-kit/api@0.25.0',
    'minor',
    '0.1.0',
    exists,
  );
  assert.deepEqual(fromTag, {
    base: '0.25.0',
    next: '0.26.0',
    tag: '@poc-plattform-kit/api@0.26.0',
  });

  const untagged = resolveNextVersion('@poc-plattform-kit/config', null, 'patch', '0.0.0', exists);
  assert.deepEqual(untagged, {
    base: '0.0.0',
    next: '0.0.1',
    tag: '@poc-plattform-kit/config@0.0.1',
  });
});

test('resolveNextVersion skips tags that already exist', () => {
  const existing = new Set(['@poc-plattform-kit/api@0.26.0']);
  const resolved = resolveNextVersion(
    '@poc-plattform-kit/api',
    '@poc-plattform-kit/api@0.25.0',
    'minor',
    '0.25.0',
    (tag) => existing.has(tag),
  );
  assert.equal(resolved.next, '0.27.0');
  assert.equal(resolved.tag, '@poc-plattform-kit/api@0.27.0');
});

test('watchPathsFor cascades api/web onto shared packages', () => {
  assert.deepEqual(
    watchPathsFor({ name: '@poc-plattform-kit/api', path: '/repo/apps/api' }).filter(
      (p) => p === 'packages' || p === 'pillars',
    ),
    ['packages', 'pillars'],
  );
  assert.ok(
    watchPathsFor({ name: '@poc-plattform-kit/web', path: '/repo/apps/web' }).includes('packages'),
  );
});

test('getLastTag lists tags via execFile args (no shell interpolation)', async () => {
  const script = await readFile(scriptUrl, 'utf8');
  assert.match(script, /run\('git', \['tag', '--sort=-v:refname', '-l',/);
  assert.doesNotMatch(script, /git tag -l "/);
  assert.doesNotMatch(script, /git tag -l `/);
  assert.doesNotMatch(script, /execSync/);
});

test('collectTagsToReconcile unions extras, HEAD tags, and latest tags', () => {
  const tags = collectTagsToReconcile(
    [' @poc-plattform-kit/api@0.26.0 ', '', '@poc-plattform-kit/web@0.18.0'],
    {
      tagsAtHead: ['@poc-plattform-kit/api@0.26.0', '@poc-plattform-kit/config@0.3.0'],
      latestTags: ['@poc-plattform-kit/web@0.17.0', null],
    },
  );
  assert.deepEqual(tags, [
    '@poc-plattform-kit/api@0.26.0',
    '@poc-plattform-kit/config@0.3.0',
    '@poc-plattform-kit/web@0.17.0',
    '@poc-plattform-kit/web@0.18.0',
  ]);
});

test('release-changed.mjs is tag-only (no commit or push to main)', async () => {
  const script = await readFile(scriptUrl, 'utf8');
  assert.match(script, /RELEASE_TAGS=/);
  assert.match(script, /RELEASE_SHA=/);
  assert.match(script, /Release tags pushed/);
  assert.match(script, /push', 'origin', \.\.\.tags/);
  assert.match(script, /create and push tags only/);
  assert.match(script, /--reconcile-tags/);
  assert.doesNotMatch(script, /HEAD:main/);
  assert.doesNotMatch(script, /pushReleaseCommit/);
  assert.doesNotMatch(script, /\[skip ci\]/);
  assert.doesNotMatch(script, /chore\/release-package-versions/);
  assert.doesNotMatch(script, /writeFileSync/);
  assert.doesNotMatch(script, /updateChangelog/);
  assert.doesNotMatch(script, /bumpPackageVersion/);
  assert.doesNotMatch(script, /github-automation-pat/);
});

test('release.yml uses GITHUB_TOKEN, tags only, and no PAT / OIDC vault', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');
  assert.match(workflow, /Reconcile GitHub Releases/);
  assert.match(workflow, /gh release create/);
  assert.match(workflow, /--reconcile-tags/);
  assert.match(workflow, /RELEASE_TAGS=/);
  assert.match(workflow, /Release tags pushed/);
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /actions: write/);
  assert.match(workflow, /secrets\.GITHUB_TOKEN/);
  assert.match(workflow, /github-actions\[bot\]/);
  assert.match(workflow, /Dispatch production deploys/);
  assert.match(workflow, /gh workflow run "\$workflow"/);
  assert.match(workflow, /release_tag=/);
  assert.match(workflow, /release_sha=/);
  assert.doesNotMatch(workflow, /github-automation-pat/);
  assert.doesNotMatch(workflow, /SSD_OPS_KEY_VAULT/);
  assert.doesNotMatch(workflow, /id-token: write/);
  assert.doesNotMatch(workflow, /azure\/login/);
  assert.doesNotMatch(workflow, /vault\.azure\.net/);
  assert.doesNotMatch(workflow, /HEAD:main/);
  assert.doesNotMatch(workflow, /Merge release PR/);
  assert.doesNotMatch(workflow, /workflow_run:/);
});

test('production deploys trigger on package tags or tagged dispatch, not every Release', async () => {
  const deployApi = await readFile(
    new URL('../.github/workflows/deploy-api.yml', import.meta.url),
    'utf8',
  );
  const deployWeb = await readFile(
    new URL('../.github/workflows/deploy-web.yml', import.meta.url),
    'utf8',
  );
  const pages = await readFile(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  for (const workflow of [deployApi, deployWeb, pages]) {
    assert.doesNotMatch(workflow, /workflow_run:/);
    assert.match(workflow, /release_tag:/);
    assert.match(workflow, /release_sha:/);
  }
  for (const workflow of [deployApi, deployWeb]) {
    assert.match(workflow, /resolve-release-tag\.mjs/);
    assert.match(workflow, /Check out the tagged commit/);
    assert.doesNotMatch(workflow, /branches: \[main\]/);
    assert.match(
      workflow,
      /github\.event\.inputs\.release_tag \|\| github\.event\.inputs\.release_sha \|\| github\.sha/,
    );
  }
  assert.match(deployApi, /'@poc-plattform-kit\/api@\*'/);
  assert.match(deployWeb, /'@poc-plattform-kit\/web@\*'/);
  assert.match(deployApi, /APP_VERSION/);
  assert.match(deployWeb, /NEXT_PUBLIC_APP_VERSION/);
  assert.match(pages, /@poc-plattform-kit\/marketing@/);
});

test('SETUP documents tag-only releases with GITHUB_TOKEN and no ruleset bypass', async () => {
  const setup = await readFile(setupUrl, 'utf8');
  assert.match(setup, /tag-only/i);
  assert.match(setup, /GITHUB_TOKEN/);
  assert.match(setup, /apply branch rulesets to tags/i);
  assert.match(setup, /no longer uses `github-automation-pat`/i);
  assert.doesNotMatch(setup, /PAT owner must be on each target repository ruleset bypass list/);
  assert.doesNotMatch(setup, /copy release\.yml \(or the PAT-read steps\)/);
});

test('production deploy workflows disable checkout credential persistence', async () => {
  for (const name of ['deploy-api.yml', 'deploy-web.yml']) {
    const workflow = await readFile(
      new URL(`../.github/workflows/${name}`, import.meta.url),
      'utf8',
    );
    assert.match(workflow, /persist-credentials: false/);
  }
});
