import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const publishUrl = new URL('../.github/workflows/publish-api-image.yml', import.meta.url);
const ciUrl = new URL('../.github/workflows/ci-publish-api-image.yml', import.meta.url);
const deployUrl = new URL('../.github/workflows/deploy-api.yml', import.meta.url);

const PINNED_SHA = 'a'.repeat(40);

function workflowJob(workflow, jobId) {
  const start = workflow.indexOf(`  ${jobId}:`);
  assert.ok(start >= 0, `missing job ${jobId}`);
  const rest = workflow.slice(start + 3);
  const next = rest.search(/\n {2}[a-z_]+:/);
  return next === -1 ? workflow.slice(start) : workflow.slice(start, start + 3 + next);
}

function usesLines(text) {
  return [...text.matchAll(/^\s*-?\s*uses:\s+(\S+)/gm)].map((match) => match[1]);
}

test('publish workflow shares deploy-api tag and dispatch triggers', async () => {
  const publish = await readFile(publishUrl, 'utf8');
  const deploy = await readFile(deployUrl, 'utf8');

  assert.match(publish, /'@poc-plattform-kit\/api@\*'/);
  assert.match(publish, /workflow_dispatch:/);
  assert.match(publish, /release_sha:/);
  assert.doesNotMatch(publish, /branches: \[main\]/);
  assert.doesNotMatch(publish, /pull_request:/);

  assert.match(deploy, /'@poc-plattform-kit\/api@\*'/);
  assert.match(deploy, /workflow_dispatch:/);
});

test('publish job builds linux/arm64 production image to GHCR sha tag only', async () => {
  const publish = await readFile(publishUrl, 'utf8');
  const job = workflowJob(publish, 'publish');

  assert.match(publish, /REGISTRY: ghcr\.io/);
  assert.match(publish, /IMAGE_NAME: singleton-sd\/platform-kit-api/);
  assert.match(publish, /ubuntu-24\.04-arm/);
  assert.match(job, /platforms: linux\/arm64/);
  assert.match(job, /target: production/);
  assert.match(job, /file: apps\/api\/Dockerfile/);
  assert.match(job, /type=raw,value=\$\{\{ steps\.sha\.outputs\.sha \}\}/);
  assert.match(job, /latest=false/);
  assert.doesNotMatch(job, /type=raw,value=latest/);
  assert.doesNotMatch(job, /linux\/amd64/);
  assert.match(job, /org\.opencontainers\.image\.source=/);
  assert.match(job, /org\.opencontainers\.image\.revision=/);
  assert.match(job, /digest: \$\{\{ steps\.build\.outputs\.digest \}\}/);
  assert.match(job, /GITHUB_STEP_SUMMARY/);
  assert.match(job, /password: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
});

test('QEMU fallback does not wait for an ARM probe to be scheduled', async () => {
  const publish = await readFile(publishUrl, 'utf8');
  const job = workflowJob(publish, 'publish');

  assert.doesNotMatch(publish, /select_runner:/);
  assert.doesNotMatch(job, /^\s+needs:/m);
  assert.match(
    job,
    /runs-on: \$\{\{ inputs\.use_qemu && 'ubuntu-24\.04' \|\| 'ubuntu-24\.04-arm' \}\}/,
  );
  assert.match(publish, /use_qemu:/);
  assert.match(job, /if: runner\.arch != 'ARM64'/);
  assert.match(job, /docker\/setup-qemu-action@[0-9a-f]{40}/);
});

test('packages: write is only on the publish job', async () => {
  const publish = await readFile(publishUrl, 'utf8');
  const job = workflowJob(publish, 'publish');

  assert.match(publish, /^permissions: \{\}$/m);
  assert.match(job, /contents: read/);
  assert.match(job, /packages: write/);
  assert.equal([...publish.matchAll(/packages: write/g)].length, 1);
  assert.doesNotMatch(job, /id-token: write/);
});

test('third-party docker actions are pinned to full commit SHAs', async () => {
  const publish = await readFile(publishUrl, 'utf8');
  const job = workflowJob(publish, 'publish');
  const thirdParty = usesLines(job).filter((ref) => !ref.startsWith('actions/'));

  assert.ok(thirdParty.length >= 4, `expected pinned docker actions, got ${thirdParty.join(', ')}`);
  for (const ref of thirdParty) {
    assert.match(ref, /@[0-9a-f]{40}$/);
  }
  assert.match(publish, /docker\/setup-qemu-action@[0-9a-f]{40} # v3\.7\.0/);
  assert.match(publish, /docker\/setup-buildx-action@[0-9a-f]{40} # v3\.12\.0/);
  assert.match(publish, /docker\/login-action@[0-9a-f]{40} # v3\.7\.0/);
  assert.match(publish, /docker\/metadata-action@[0-9a-f]{40} # v5\.10\.0/);
  assert.match(publish, /docker\/build-push-action@[0-9a-f]{40} # v6\.19\.2/);
});

test('usesLines includes dashed action steps and rejects an unpinned docker action', () => {
  const snippet = `
    steps:
      - uses: docker/login-action@v3
      - name: build
        uses: docker/build-push-action@${PINNED_SHA}
  `;
  const refs = usesLines(snippet).filter((ref) => !ref.startsWith('actions/'));
  assert.deepEqual(refs, ['docker/login-action@v3', `docker/build-push-action@${PINNED_SHA}`]);
  assert.doesNotMatch(refs[0], /@[0-9a-f]{40}$/);
  assert.match(refs[1], /@[0-9a-f]{40}$/);
});

test('checkout uses a full SHA ref and rejects abbreviated release_sha', async () => {
  const publish = await readFile(publishUrl, 'utf8');
  const job = workflowJob(publish, 'publish');

  assert.match(job, /\^\[0-9a-fA-F\]\{40\}\$/);
  assert.doesNotMatch(job, /\{7,40\}/);
  assert.match(job, /ref: \$\{\{ steps\.sha\.outputs\.sha \}\}/);
  assert.doesNotMatch(job, /ref: \$\{\{ inputs\.release_sha \|\| github\.sha \}\}/);
  assert.match(job, /actions\/checkout@[0-9a-f]{40}/);
});

test('deploy-api.yml remains the ACA rollback path', async () => {
  const deploy = await readFile(deployUrl, 'utf8');
  assert.match(deploy, /ssdpocpkacrdevae/);
  assert.match(deploy, /ssd-pocpk-aca-api-dev-ae/);
  assert.match(deploy, /--target production/);
  assert.doesNotMatch(deploy, /ghcr\.io\/singleton-sd\/platform-kit-api/);
  assert.doesNotMatch(deploy, /ubuntu-24\.04-arm/);
});

test('CI contract workflow runs the node test without publishing', async () => {
  const ci = await readFile(ciUrl, 'utf8');
  assert.match(ci, /pull_request:/);
  assert.match(ci, /\.github\/workflows\/deploy-api\.yml/);
  assert.match(ci, /node --test scripts\/publish-api-image-workflow\.test\.mjs/);
  assert.match(ci, /actions\/checkout@[0-9a-f]{40}/);
  assert.doesNotMatch(ci, /docker\/build-push-action/);
  assert.doesNotMatch(ci, /packages: write/);
});
