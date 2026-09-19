import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // Component tests mount the real single-file components.
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js', 'src/**/*.test.js'],
    // Coverage is a map of what is untested, not a target (BFD-25): all of
    // src is measured, and no number fails the run.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,vue}'],
      exclude: ['src/**/*.test.js'],
      reporter: ['text', 'html'],
    },
  },
})
