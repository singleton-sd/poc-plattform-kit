import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const marketingRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(marketingRoot, '../..');
const configPath = join(marketingRoot, 'public/admin/config.yml');

const retiredAuthHost = ['auth', 'singletonsd.com'].join('.');
const retiredOauthKit = ['cms', 'oauth', 'kit'].join('-');

const skipDirNames = new Set(['.git', 'node_modules', 'dist', '.astro', 'coverage']);
const skipFileNames = new Set(['CHANGELOG.md', 'changelog.json']);
const textExtensions = new Set([
  '.md',
  '.yml',
  '.yaml',
  '.html',
  '.mjs',
  '.js',
  '.cjs',
  '.ts',
  '.tsx',
  '.json',
]);

function parseBackendFields(yaml) {
  const match = yaml.match(/^backend:\n((?:[ \t].*\n)+)/m);
  assert.ok(match, 'config.yml is missing a backend block');
  const fields = {};
  for (const line of match[1].split('\n')) {
    const field = line.match(/^[ \t]+([A-Za-z0-9_]+):\s*(.+?)\s*$/);
    if (field) {
      fields[field[1]] = field[2];
    }
  }
  return fields;
}

function collectLiveFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (skipDirNames.has(entry.name)) continue;
      out.push(...collectLiveFiles(join(dir, entry.name)));
      continue;
    }
    if (skipFileNames.has(entry.name)) continue;
    if (entry.name.endsWith('.test.mjs') || entry.name.endsWith('.test.ts')) {
      continue;
    }
    const ext = entry.name.includes('.') ? entry.name.slice(entry.name.lastIndexOf('.')) : '';
    if (textExtensions.has(ext)) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

test('Decap backend points at the api.singletonsd.com cms-auth gateway', () => {
  const yaml = readFileSync(configPath, 'utf8');
  const fields = parseBackendFields(yaml);
  assert.equal(fields.name, 'github');
  assert.equal(fields.repo, 'singleton-sd/poc-plattform-kit');
  assert.equal(fields.branch, 'main');
  assert.equal(fields.base_url, 'https://api.singletonsd.com');
  assert.equal(fields.auth_endpoint, 'v1/cms-auth/auth');
});

test('live docs and config do not send CMS login to the retired OAuth host', () => {
  const hits = [];
  for (const file of collectLiveFiles(repoRoot)) {
    const text = readFileSync(file, 'utf8');
    if (text.includes(retiredAuthHost) || text.includes(retiredOauthKit)) {
      hits.push(file.slice(repoRoot.length + 1));
    }
  }
  assert.deepEqual(hits, []);
});
