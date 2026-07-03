import js from '@eslint/js'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import eslintConfigPrettier from 'eslint-config-prettier'
import importX from 'eslint-plugin-import-x'
import prettierRecommended from 'eslint-plugin-prettier/recommended'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'chunks/**',
      'coverage/**',
      'index.js',
      'node_modules/**',
      'reporters/**',
      'sentry.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  importX.flatConfigs.recommended,
  {
    files: ['**/*.{js,cjs,mjs,ts}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'import-x': importX,
    },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          project: './tsconfig.json',
        }),
      ],
    },
    rules: {
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'import-x/extensions': [
        'error',
        'ignorePackages',
        {
          cjs: 'never',
          js: 'never',
          mjs: 'never',
          ts: 'never',
        },
      ],
      'import-x/no-unresolved': [
        'error',
        {
          ignore: ['^@electron/remote$', '^@sentry/electron$', '^moment-timezone$', '^views/'],
        },
      ],
      'linebreak-style': ['error', 'unix'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-shadow': 'off',
      'no-unused-vars': 'off',
      'no-var': 'error',
      'unicode-bom': 'error',
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      'import-x/extensions': 'off',
    },
  },
  {
    files: ['scripts/**/*.cjs'],
    rules: {
      'no-console': 'off',
    },
  },
  eslintConfigPrettier,
  prettierRecommended,
)
