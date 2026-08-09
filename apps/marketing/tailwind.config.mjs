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
          inverse: 'var(--fg-inverse)',
          brand: 'var(--fg-brand)',
        },
        bg: {
          DEFAULT: 'var(--bg-default)',
          muted: 'var(--bg-muted)',
          subtle: 'var(--bg-subtle)',
          inverse: 'var(--bg-inverse)',
          hero: 'var(--bg-hero)',
        },
        accent: {
          DEFAULT: 'var(--accent-default)',
          hover: 'var(--accent-hover)',
          muted: 'var(--accent-muted)',
          on: 'var(--accent-on-accent)',
          bg: 'var(--accent-bg)',
        },
        border: {
          DEFAULT: 'var(--border-default)',
          muted: 'var(--border-muted)',
          strong: 'var(--border-strong)',
        },
        status: {
          error: 'var(--status-error)',
          'error-bg': 'var(--status-error-bg)',
          success: 'var(--status-success)',
          'success-bg': 'var(--status-success-bg)',
        },
      },
      fontFamily: {
        heading: 'var(--font-families-heading)',
        body: 'var(--font-families-body)',
      },
      fontSize: {
        display: ['4.5rem', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '500' }],
        h1: ['2.5rem', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '500' }],
        h2: ['2rem', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '500' }],
        h3: ['1.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '500' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5' }],
        caption: ['0.75rem', { lineHeight: '1.5' }],
        legal: ['0.625rem', { lineHeight: '1.5' }],
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '2rem',
        xl: '4rem',
        xxl: '8rem',
      },
      borderRadius: {
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      maxWidth: {
        content: '68.5rem', // 1096px — Figma 12-col content width
      },
    },
  },
  plugins: [],
};
