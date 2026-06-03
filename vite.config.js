import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Multi-page setup: the admin dashboard and the standalone JH preview are two
// separate entry HTML files that both pull from src/widget + src/shared.
// `npm run dev` serves both; `npm run build` emits both.
export default defineConfig({
  root: '.',
  server: {
    open: '/index.html',
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        dashboard: resolve(import.meta.dirname, 'index.html'),
        preview: resolve(import.meta.dirname, 'preview.html'),
      },
    },
  },
});
