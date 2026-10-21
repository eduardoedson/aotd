import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

const hooksRules = {
  ...reactHooks.configs.recommended.rules,
  'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
};

export default [
  {
    ignores: [
      'dist',
      'coverage',
      'node_modules',
      'server/node_modules',
      'server/data',
      '.history',
      'design',
      'playwright-report',
      'test-results',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx'],
  })),
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: hooksRules,
  },
  {
    files: ['**/*.{js,jsx}'],
    rules: {
      // Core ESLint cannot see JSX usage, so components (PascalCase) are ignored here.
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // The entry point only bootstraps the app, Fast Refresh does not apply to it.
    files: ['src/index.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
  {
    files: ['public/sw.js'],
    languageOptions: { sourceType: 'script', globals: globals.serviceworker },
  },
  {
    files: [
      'server/**/*.js',
      'vite.config.js',
      'eslint.config.js',
      'playwright.config.ts',
      'e2e/**',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.test.{js,jsx,ts,tsx}', 'src/setupTests.js', 'src/test/**'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  prettier,
];
