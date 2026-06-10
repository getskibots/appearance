import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Multi-page: the admin dashboard (index.html), the standalone JH preview
// (preview.html), and the Agent Widget Weather tab (weather.html) — all vanilla,
// pulling from src/widget + src/shared. `npm run dev` serves them; `npm run build`
// emits them. Built under /appearance/ for GitHub Pages
// (https://getskibots.github.io/appearance/); dev stays at '/'.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/appearance/' : '/',
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
