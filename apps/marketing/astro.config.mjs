import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// Astro static marketing site (SWA Free)
export default defineConfig({
  output: 'static',
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
  ],
});
