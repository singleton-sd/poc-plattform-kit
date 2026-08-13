import type { Config } from 'tailwindcss';

// Colors map to @singleton-sd/tokens CSS variables imported in
// src/app/globals.css -- never hardcode palette hex here (see AGENTS.md).
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fg: {
          DEFAULT: 'var(--ssd-color-text-default)',
          muted: 'var(--ssd-color-text-muted)',
          subtle: 'var(--ssd-color-text-subtle)',
        },
        bg: {
          DEFAULT: 'var(--ssd-color-background-default)',
          muted: 'var(--ssd-color-background-muted)',
          subtle: 'var(--ssd-color-background-subtle)',
        },
        accent: {
          DEFAULT: 'var(--ssd-color-background-brand)',
          on: 'var(--ssd-color-text-on-brand)',
          bg: 'var(--pk-accent-bg)',
        },
      },
      fontFamily: {
        heading: 'var(--ssd-font-family-heading)',
        body: 'var(--ssd-font-family-body)',
      },
    },
  },
  plugins: [],
};

export default config;
