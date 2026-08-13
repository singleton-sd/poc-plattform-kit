import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { copyMarketingTokenCss } from './copy-token-css.mjs';

const marketingRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceExtensions = new Set(['.astro', '.css', '.html', '.js', '.mjs', '.cjs', '.ts']);
const skipDirNames = new Set(['node_modules', 'dist', '.astro', 'tokens']);

function collectSourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (skipDirNames.has(entry.name)) continue;
      out.push(...collectSourceFiles(join(dir, entry.name)));
      continue;
    }
    if (entry.name.endsWith('.test.mjs')) continue;
    const ext = entry.name.slice(entry.name.lastIndexOf('.'));
    if (sourceExtensions.has(ext)) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

test('GitLab npm registry is configured for the @singleton-sd scope', () => {
  const npmrc = readFileSync(join(marketingRoot, '../../.npmrc'), 'utf8');
  assert.match(npmrc, /@singleton-sd:registry=https:\/\/gitlab\.com\/api\/v4\/packages\/npm\//);
});

test('marketing depends on the published @singleton-sd/tokens package', () => {
  const pkg = JSON.parse(readFileSync(join(marketingRoot, 'package.json'), 'utf8'));
  assert.ok(
    pkg.dependencies?.['@singleton-sd/tokens'],
    'apps/marketing/package.json must depend on @singleton-sd/tokens',
  );
});

test('marketing CSS imports token sheets from the npm package, not the CDN', () => {
  const globalCss = readFileSync(join(marketingRoot, 'src/styles/global.css'), 'utf8');
  assert.match(globalCss, /@import\s+['"]@singleton-sd\/tokens\/css\/light['"]/);
  assert.match(globalCss, /@import\s+['"]@singleton-sd\/tokens\/css\/dark['"]/);
  assert.doesNotMatch(globalCss, /tokens\.design\.singletonsd\.com/);
});

test('marketing Tailwind theme reads --ssd-* token variables', () => {
  const tailwind = readFileSync(join(marketingRoot, 'tailwind.config.mjs'), 'utf8');
  assert.match(tailwind, /--ssd-color-text-default/);
  assert.match(tailwind, /--ssd-color-background-default/);
  assert.match(tailwind, /--ssd-font-family-heading/);
  assert.doesNotMatch(tailwind, /--font-families-/);
  assert.doesNotMatch(tailwind, /--fg-default/);
});

test('marketing source does not load design tokens from the CDN', () => {
  const hits = [];
  for (const file of collectSourceFiles(marketingRoot)) {
    const text = readFileSync(file, 'utf8');
    if (text.includes('tokens.design.singletonsd.com')) {
      hits.push(relative(marketingRoot, file).replaceAll('\\', '/'));
    }
  }
  assert.deepEqual(hits, [], `CDN token URLs remain in: ${hits.join(', ')}`);
});

test('copyMarketingTokenCss writes npm token sheets into public/admin/tokens', () => {
  copyMarketingTokenCss();
  const css = readFileSync(join(marketingRoot, 'public/admin/tokens/dark.css'), 'utf8');
  assert.match(css, /--ssd-color-background-default/);
  assert.doesNotMatch(css, /tokens\.design\.singletonsd\.com/);
});
