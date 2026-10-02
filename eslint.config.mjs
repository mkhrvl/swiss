import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/.output/**',
    '**/.wxt/**',
    '**/bin/**',
    '**/obj/**',
    '**/public/**',
    'artifacts/**',
    'TestResults/**',
    'playwright-report/**',
    '.agents/**',
    '.codex/**',
    '.sonarqube/**',
    '.scannerwork/**',
  ]),
  {
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}', '*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['apps/*/tests/browser/*.mjs', 'scripts/*browser*.mjs'],
    languageOptions: {
      // These Node runners also contain callbacks evaluated in the browser.
      globals: globals.browser,
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['packages/core/src/identity-passwords/worker.mjs'],
    languageOptions: {
      globals: globals.worker,
    },
  },
  {
    files: ['**/*.test.ts', 'apps/*/*.config.ts', 'vitest.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['apps/extension/entrypoints/**/*.ts'],
    languageOptions: {
      globals: {
        defineBackground: 'readonly',
        defineUnlistedScript: 'readonly',
      },
    },
  },
  {
    files: ['apps/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['**/*.tsx'],
    extends: [jsxA11y.flatConfigs.recommended],
  },
  prettier,
]);
