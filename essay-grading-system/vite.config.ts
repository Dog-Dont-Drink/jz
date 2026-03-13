import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: './', // 使用相对路径，适配各种部署环境
  server: {
    host: '0.0.0.0',
    port: 5180,
    proxy: {
      // Dev-only proxy to bypass browser CORS when calling Baimiao web APIs.
      // Frontend uses `VITE_BAIMIAO_BASE_URL=/baimiao` by default.
      '/baimiao': {
        target: 'https://web.baimiaoapp.com',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/baimiao/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Some endpoints validate Origin/Referer; make them look like same-origin.
            proxyReq.setHeader('origin', 'https://web.baimiaoapp.com')
            proxyReq.setHeader('referer', 'https://web.baimiaoapp.com/')
          })
        },
      },
    },
  },
})
