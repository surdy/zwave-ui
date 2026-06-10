/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Backend (zwave-js-ui) to proxy realtime + REST to during development.
const backend = process.env.VITE_BACKEND ?? 'http://localhost:8091'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
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
  // `vite preview` serves the production build; mirror the dev proxy so the
  // integration smoke test (and manual preview) can reach a real backend.
  preview: {
    port: 8092,
    proxy: {
      '/socket.io': {
        target: backend,
        changeOrigin: true,
        ws: true,
      },
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
