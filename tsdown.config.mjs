import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsdown'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  outDir: '.',
  outExtensions: () => ({ js: '.js' }),
  format: ['cjs'],
  define: {
    __REPORTER_VERSION__: JSON.stringify(version),
  },
  deps: {
    neverBundle: [
      '@electron/remote',
      '@sentry/electron',
      'electron',
      'lodash',
      'moment-timezone',
      'node-fetch',
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-i18next',
      'semver',
      /^views\//,
    ],
  },
  dts: false,
  clean: ['index.js'],
  sourcemap: false,
  hash: false,
  treeshake: false,
  minify: false,
  shims: false,
  target: 'es2018',
})
