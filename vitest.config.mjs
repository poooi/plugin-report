import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['reporters/*.js'],
      exclude: ['reporters/index.js'],
      all: true,
      thresholds: {
        lines: 95,
        functions: 95,
        statements: 95,
        branches: 84,
      },
    },
  },
})
