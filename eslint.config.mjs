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
      'storybook-static/**',
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
      '@typescript-eslint/no-explicit-any': 'error',
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
    files: ['src/**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
    },
  },
  {
    files: ['src/types/vendor.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
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
