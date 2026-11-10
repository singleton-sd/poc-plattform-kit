import assert from 'node:assert/strict';
import test from 'node:test';
import { isAbsoluteUrl, normalizeBase, stripBase, withBase } from './with-base.mjs';

test('normalizeBase always has a trailing slash', () => {
  assert.equal(normalizeBase('/'), '/');
  assert.equal(normalizeBase('/pr-preview/pr-12'), '/pr-preview/pr-12/');
  assert.equal(normalizeBase('/pr-preview/pr-12/'), '/pr-preview/pr-12/');
  assert.equal(normalizeBase(''), '/');
});

test('withBase prefixes site-relative paths at root', () => {
  assert.equal(withBase('/', '/'), '/');
  assert.equal(withBase('/features', '/'), '/features');
  assert.equal(withBase('features', '/'), '/features');
  assert.equal(withBase('/images/about/mission.png', '/'), '/images/about/mission.png');
});

test('withBase prefixes site-relative paths under a preview subpath', () => {
  const base = '/pr-preview/pr-12/';
  assert.equal(withBase('/', base), '/pr-preview/pr-12/');
  assert.equal(withBase('/features', base), '/pr-preview/pr-12/features');
  assert.equal(withBase('/contact', base), '/pr-preview/pr-12/contact');
  assert.equal(
    withBase('/images/about/mission.png', base),
    '/pr-preview/pr-12/images/about/mission.png',
  );
});

test('withBase leaves absolute and hash URLs unchanged', () => {
  const base = '/pr-preview/pr-12/';
  assert.equal(
    withBase('https://app.plattform-kit.poc.singletonsd.com', base),
    'https://app.plattform-kit.poc.singletonsd.com',
  );
  assert.equal(withBase('mailto:support@singletonsd.com', base), 'mailto:support@singletonsd.com');
  assert.equal(withBase('#pricing', base), '#pricing');
  assert.ok(isAbsoluteUrl('https://example.com/x'));
  assert.ok(isAbsoluteUrl('mailto:a@b.c'));
  assert.equal(isAbsoluteUrl('/features'), false);
});

test('stripBase reverses withBase for nav matching', () => {
  const base = '/pr-preview/pr-12/';
  assert.equal(stripBase('/pr-preview/pr-12/features', base), '/features');
  assert.equal(stripBase('/pr-preview/pr-12/', base), '/');
  assert.equal(stripBase('/pr-preview/pr-12', base), '/');
  assert.equal(stripBase('/features', '/'), '/features');
  assert.equal(stripBase('/', '/'), '/');
});
