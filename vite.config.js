import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Multi-page: the admin dashboard (index.html), the standalone JH preview
// (preview.html), and the Agent Widget Weather tab (weather.html) — all vanilla,
// pulling from src/widget + src/shared. `npm run dev` serves them; `npm run build`
// emits them.
// Base path is deploy-target-aware: GitHub Pages serves under /appearance/
// (https://getskibots.github.io/appearance/); Vercel + local serve at root '/'
// so the dashboard is same-origin with the /api/appearance functions.
export default defineConfig(() => ({
  base: process.env.GITHUB_ACTIONS ? '/appearance/' : '/',
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
        weather: resolve(import.meta.dirname, 'weather.html'),
      },
    },
  },
}));
