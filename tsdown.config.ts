const { defineConfig } = require('tsdown')
const packageMeta = require('./package.json')

module.exports = defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  outDir: '.',
  outExtensions: () => ({ js: '.js' }),
  format: ['cjs'],
  define: {
    __REPORTER_VERSION__: JSON.stringify(packageMeta.version),
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
  outputOptions: {
    chunkFileNames: 'chunks/[name].js',
  },
  treeshake: false,
  minify: false,
  shims: false,
  target: 'es2018',
})
