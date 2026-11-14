import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pagesUrl = new URL('../.github/workflows/pages.yml', import.meta.url);
const previewUrl = new URL('../.github/workflows/preview-marketing.yml', import.meta.url);
const closeUrl = new URL('../.github/workflows/preview-marketing-close.yml', import.meta.url);

test('preview build is read-only; publish is a separate write job', async () => {
  const preview = await readFile(previewUrl, 'utf8');
  assert.match(preview, /^permissions:\n {2}contents: read\n {2}pull-requests: read$/m);
  assert.match(preview, /persist-credentials: false/);
  assert.match(preview, /name: Build marketing preview/);
  assert.match(preview, /name: Build \+ GitHub Pages preview/);
  assert.match(preview, /upload-artifact@v4/);
  assert.match(preview, /download-artifact@v4/);
});

test('preview publish checks out the trusted base SHA and posts a comment', async () => {
  const preview = await readFile(previewUrl, 'utf8');
  assert.ok(preview.includes('ref: ${{ github.event.pull_request.base.sha }}'));
  assert.match(preview, /issues\.createComment/);
  assert.doesNotMatch(preview, /pulls\.update/);
  assert.match(preview, /concurrency:\n {6}group: gh-pages\n {6}cancel-in-progress: false/);
});

test('close workflow has no path filter and explicitly removes the preview', async () => {
  const close = await readFile(closeUrl, 'utf8');
  assert.doesNotMatch(close, /^\s+paths:/m);
  assert.match(close, /types: \[closed\]/);
  assert.match(close, /action: remove/);
  assert.match(close, /group: gh-pages/);
  assert.ok(close.includes('ref: ${{ github.event.pull_request.base.sha }}'));
});

test('pages.yml rebuilds on marketing content or a tagged Release dispatch', async () => {
  const pages = await readFile(pagesUrl, 'utf8');
  assert.doesNotMatch(pages, /workflow_run:/);
  assert.match(pages, /release_tag:/);
  assert.match(pages, /release_sha:/);
  assert.match(pages, /Verify release tag matches SHA/);
  assert.match(pages, /group: gh-pages/);
  assert.match(pages, /pnpm-lock\.yaml/);
  assert.match(pages, /persist-credentials: false/);
  assert.match(pages, /Retry production deploy/);
});
