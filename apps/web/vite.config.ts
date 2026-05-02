import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  // Dev: "/" so HMR and module URLs match the Vite server. Prod: "./" so the
  // same build can sit at / or under a prefix when combined with <base href>
  // (optionally rewritten by nginx) — see index.html and nginx.conf.
  base: mode === 'development' ? '/' : './',
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
}));
