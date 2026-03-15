import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      '/api/jimeng': 'http://127.0.0.1:8787',
    },
  },
  preview: {
    proxy: {
      '/api/jimeng': 'http://127.0.0.1:8787',
    },
  },
})
