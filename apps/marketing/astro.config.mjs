import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import { copyMarketingTokenCss } from './scripts/copy-token-css.mjs';

copyMarketingTokenCss();

// Astro static marketing site (SWA Free)
export default defineConfig({
  site: 'https://plattform-kit.poc.singletonsd.com',
  output: 'static',
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
  ],
});
