// @ts-check
import js from '@eslint/js';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/out/**',
      '**/storybook-static/**',
      '**/coverage/**',
      '.worktrees/**',
      'infra/main.json',
      'apps/web/public/**',
      'packages/api-client/src/generated/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['apps/marketing/src/lib/leads/bind-lead-form.mjs'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
];
