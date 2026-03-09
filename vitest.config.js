import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js', 'src/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: [
        'src/models/player.js',
        'src/models/location.js',
        'src/models/character.js',
        'src/models/item.js',
        'src/engine/**/*.js',
        'src/utils/**/*.js',
        'src/composables/useNarrative.js',
      ],
      reporter: ['text', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
})
