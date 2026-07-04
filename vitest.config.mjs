import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/reporters/**/*.ts', 'src/remodel-debug-recorder.ts'],
      exclude: ['src/reporters/index.ts'],
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
