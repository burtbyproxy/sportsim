import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Silence legacy JS API deprecation warning — will migrate to modern API when stable
        silenceDeprecations: ['legacy-js-api'],
      },
    },
  },
  worker: {
    format: 'es',
  },
})
