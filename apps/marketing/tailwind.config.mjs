/** @type {import('tailwindcss').Config} */
// Colors map to Singleton SD design token CSS variables — never hardcode palette hex.
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        fg: {
          DEFAULT: 'var(--fg-default)',
          muted: 'var(--fg-muted)',
          subtle: 'var(--fg-subtle)',
        },
        bg: {
          DEFAULT: 'var(--bg-default)',
          muted: 'var(--bg-muted)',
          subtle: 'var(--bg-subtle)',
        },
        accent: {
          DEFAULT: 'var(--accent-default)',
          on: 'var(--accent-on-accent)',
          bg: 'var(--accent-bg)',
        },
      },
      fontFamily: {
        heading: 'var(--font-families-heading)',
        body: 'var(--font-families-body)',
      },
    },
  },
  plugins: [],
};
