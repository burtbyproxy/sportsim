import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // Component tests mount the real single-file components.
  plugins: [vue()],
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
