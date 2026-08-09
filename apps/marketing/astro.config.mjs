import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

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
