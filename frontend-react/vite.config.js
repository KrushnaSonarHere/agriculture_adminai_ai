import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '../backend/static/react'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/auth':          'http://127.0.0.1:8000',
      '/farmers':       'http://127.0.0.1:8000',
      '/schemes':       'http://127.0.0.1:8000',
      '/applications':  'http://127.0.0.1:8000',
      '/grievances':    'http://127.0.0.1:8000',
      '/documents':     'http://127.0.0.1:8000',
      '/ocr':           'http://127.0.0.1:8000',
      '/uploads':       'http://127.0.0.1:8000',
      '/notifications': 'http://127.0.0.1:8000',
      '/agribot':       'http://127.0.0.1:8000',
      // Bhashini STT API proxy (avoids CORS in dev)
      '/bhashini': {
        target:      'https://dhruva-api.bhashini.gov.in',
        changeOrigin: true,
        rewrite:     (path) => path.replace(/^\/bhashini/, ''),
      },
    },
  },
})


