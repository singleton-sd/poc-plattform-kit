import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const marketingRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Copy published token CSS into public/admin so the static Decap SPA can
 * @import it without hitting the token CDN. Astro copies public/ into dist.
 */
export function copyMarketingTokenCss() {
  const darkCss = require.resolve('@singleton-sd/tokens/css/dark');
  const lightCss = require.resolve('@singleton-sd/tokens/css/light');
  const rootDarkCss = require.resolve('@singleton-sd/tokens/css/root/dark');
  const dest = join(marketingRoot, 'public/admin/tokens');
  mkdirSync(dest, { recursive: true });
  copyFileSync(darkCss, join(dest, 'dark.css'));
  copyFileSync(lightCss, join(dest, 'light.css'));
  copyFileSync(rootDarkCss, join(dest, 'root-dark.css'));
}

const invokedDirectly =
  Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  copyMarketingTokenCss();
}
