/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Backend (zwave-js-ui) to proxy realtime + REST to during development.
const backend = process.env.VITE_BACKEND ?? 'http://localhost:8091'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 8092,
    proxy: {
      // socket.io realtime channel (websocket + polling)
      '/socket.io': {
        target: backend,
        changeOrigin: true,
        ws: true,
      },
      // REST API
      '/api': {
        target: backend,
        changeOrigin: true,
      },
      '/health': { target: backend, changeOrigin: true },
      '/version': { target: backend, changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
  },
})
