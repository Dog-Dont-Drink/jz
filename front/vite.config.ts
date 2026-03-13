import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    // If you run backend at :8000, this avoids CORS in local dev
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})

