import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, before, test } from 'node:test';
import { parseArgs, parseScenarioNames, resolveClientSpecifier } from './seed.mjs';

test('parseArgs defaults to demo-friendly settings with no flags', () => {
  const args = parseArgs([]);
  assert.equal(args.list, false);
  assert.equal(args.verify, true);
  assert.equal(args.client, '@prisma/client');
  assert.equal(args.scenarios, undefined);
  assert.equal(args.databaseUrl, undefined);
});

test('parseArgs reads --scenarios, --client, --database-url, --list, --no-verify', () => {
  const args = parseArgs([
    '--scenarios=demo,pillar/tenant/owner',
    '--client=./generated/preview-client',
    '--database-url=file:./preview.db',
    '--no-verify',
  ]);
  assert.equal(args.scenarios, 'demo,pillar/tenant/owner');
  assert.equal(args.client, './generated/preview-client');
  assert.equal(args.databaseUrl, 'file:./preview.db');
  assert.equal(args.verify, false);
});

test('parseArgs rejects an unknown flag', () => {
  assert.throws(() => parseArgs(['--bogus']), /Unknown argument/);
});

test('parseScenarioNames trims and drops empty entries', () => {
  assert.deepEqual(parseScenarioNames(' demo , pillar/tenant/owner ,,'), [
    'demo',
    'pillar/tenant/owner',
  ]);
});

test('resolveClientSpecifier passes bare specifiers through untouched', () => {
  assert.equal(resolveClientSpecifier('@prisma/client'), '@prisma/client');
});

let dir;
before(() => {
  dir = mkdtempSync(join(tmpdir(), 'resolve-client-specifier-'));
});
after(() => {
  rmSync(dir, { recursive: true, force: true });
});

test('resolveClientSpecifier resolves a relative directory path to its index.js', () => {
  // A generated Prisma client's package.json "exports" field only applies to
  // bare-specifier resolution; a file:// URL to the directory itself is not
  // resolved via package.json by Node's ESM loader, so this must point at
  // the entry file explicitly (see the "Directory import ... is not
  // supported" failure this regression-tests).
  writeFileSync(join(dir, 'index.js'), 'module.exports = {};');
  const resolved = resolveClientSpecifier(dir);
  assert.equal(resolved, pathToFileURL(join(dir, 'index.js')).href);
});
