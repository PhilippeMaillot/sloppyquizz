import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'quiz.omnissh.app'
    ],
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://backend:8000',
        changeOrigin: true,
        ws: true,
      },
      '/uploads': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
})