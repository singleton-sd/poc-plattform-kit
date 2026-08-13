import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const webRoot = process.cwd();
const sourceExtensions = new Set(['.css', '.html', '.js', '.mjs', '.cjs', '.ts', '.tsx']);
const skipDirNames = new Set([
  'node_modules',
  '.next',
  'out',
  'storybook-static',
  'coverage',
  'dist',
]);

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (skipDirNames.has(entry.name)) continue;
      out.push(...collectSourceFiles(join(dir, entry.name)));
      continue;
    }
    if (/\.test\.(ts|tsx|js|mjs)$/.test(entry.name)) continue;
    const ext = entry.name.slice(entry.name.lastIndexOf('.'));
    if (sourceExtensions.has(ext)) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

describe('web token consumption', () => {
  it('configures the GitLab npm registry for the @singleton-sd scope', () => {
    const npmrc = readFileSync(join(webRoot, '../../.npmrc'), 'utf8');
    expect(npmrc).toMatch(/@singleton-sd:registry=https:\/\/gitlab\.com\/api\/v4\/packages\/npm\//);
  });

  it('depends on the published @singleton-sd/tokens package', () => {
    const pkg = JSON.parse(readFileSync(join(webRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.['@singleton-sd/tokens']).toBeTruthy();
  });

  it('imports token sheets from the npm package, not the CDN', () => {
    const globalCss = readFileSync(join(webRoot, 'src/app/globals.css'), 'utf8');
    expect(globalCss).toMatch(/@import\s+['"]@singleton-sd\/tokens\/css\/light['"]/);
    expect(globalCss).toMatch(/@import\s+['"]@singleton-sd\/tokens\/css\/dark['"]/);
    expect(globalCss).not.toMatch(/tokens\.design\.singletonsd\.com/);
  });

  it('maps the Tailwind theme to --ssd-* token variables', () => {
    const tailwind = readFileSync(join(webRoot, 'tailwind.config.ts'), 'utf8');
    expect(tailwind).toMatch(/--ssd-color-text-default/);
    expect(tailwind).toMatch(/--ssd-color-background-default/);
    expect(tailwind).toMatch(/--ssd-font-family-heading/);
    expect(tailwind).not.toMatch(/--font-families-/);
    expect(tailwind).not.toMatch(/--fg-default/);
  });

  it('does not load design tokens from the CDN', () => {
    const hits = collectSourceFiles(webRoot)
      .filter((file) => readFileSync(file, 'utf8').includes('tokens.design.singletonsd.com'))
      .map((file) => relative(webRoot, file).replaceAll('\\', '/'));
    expect(hits).toEqual([]);
  });
});
