import type { Config } from 'tailwindcss';

// Colors map to the Singleton SD design token CSS variables imported in
// src/app/globals.css -- never hardcode palette hex here (see AGENTS.md).
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
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

export default config;
