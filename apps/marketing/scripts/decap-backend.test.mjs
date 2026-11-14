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

const skipDirNames = new Set([
  '.git',
  'node_modules',
  'dist',
  '.astro',
  'coverage',
  '.agents',
  '.claude',
  '.codex',
  '.worktrees',
  '.pnpm-store',
  '.turbo',
  '.next',
  'out',
  'storybook-static',
]);
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
  '.astro',
]);

function unquoteYamlScalar(value) {
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseBackendFields(yaml) {
  const normalized = String(yaml).replaceAll('\r\n', '\n');
  const match = normalized.match(/^backend:\n((?: {2}.*\n)+)/m);
  assert.ok(match, 'config.yml is missing a backend block');
  const fields = {};
  for (const line of match[1].split('\n')) {
    // Only the backend mapping's own keys (two-space indent). Nested
    // mappings must not overwrite name/base_url.
    const field = line.match(/^ {2}([A-Za-z0-9_]+):\s+(\S.*)$/);
    if (field) {
      fields[field[1]] = unquoteYamlScalar(field[2].trimEnd());
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

test('parseBackendFields treats quoted YAML scalars as unquoted strings', () => {
  const fields = parseBackendFields(`backend:
  name: github
  repo: "singleton-sd/poc-plattform-kit"
  branch: 'main'
  base_url: "https://api.singletonsd.com"
  auth_endpoint: 'v1/cms-auth/auth'
`);
  assert.equal(fields.base_url, 'https://api.singletonsd.com');
  assert.equal(fields.auth_endpoint, 'v1/cms-auth/auth');
  assert.equal(fields.repo, 'singleton-sd/poc-plattform-kit');
  assert.equal(fields.branch, 'main');
});

test('parseBackendFields accepts CRLF and ignores nested mappings', () => {
  const yaml = [
    'backend:',
    '  name: github',
    '  extra:',
    '    name: not-github',
    '  base_url: https://api.singletonsd.com',
    '  auth_endpoint: v1/cms-auth/auth',
    '',
  ].join('\r\n');
  const fields = parseBackendFields(yaml);
  assert.equal(fields.name, 'github');
  assert.equal(fields.base_url, 'https://api.singletonsd.com');
  assert.equal(fields.auth_endpoint, 'v1/cms-auth/auth');
});

function mentionsRetiredCmsAuthHost(text) {
  if (text.includes(retiredOauthKit)) {
    return true;
  }
  // Keycloak (ADR-004 / ADR-0006) issues tokens at
  // auth.singletonsd.com/realms/<product>. Decap CMS must still not use that
  // host as an OAuth backend.
  const withoutKeycloakIssuer = text.replaceAll(
    new RegExp(
      `https?://${retiredAuthHost.replaceAll('.', '\\.')}/realms/(?:<product>|[A-Za-z0-9._~-]+)`,
      'g',
    ),
    '',
  );
  return withoutKeycloakIssuer.includes(retiredAuthHost);
}

test('Keycloak issuer exemption is limited to /realms/<product> issuers', () => {
  assert.equal(
    mentionsRetiredCmsAuthHost('issuer: https://auth.singletonsd.com/realms/<product>'),
    false,
  );
  assert.equal(
    mentionsRetiredCmsAuthHost('issuer: https://auth.singletonsd.com/realms/plattform-kit'),
    false,
  );
  assert.equal(
    mentionsRetiredCmsAuthHost(
      ['backend:', '  name: github', '  base_url: https://auth.singletonsd.com/oauth'].join('\n'),
    ),
    true,
  );
});

test('live docs and config do not send CMS login to the retired OAuth host', () => {
  const hits = [];
  for (const file of collectLiveFiles(repoRoot)) {
    const text = readFileSync(file, 'utf8');
    if (mentionsRetiredCmsAuthHost(text)) {
      hits.push(file.slice(repoRoot.length + 1));
    }
  }
  assert.deepEqual(hits, []);
});
