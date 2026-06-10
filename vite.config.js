import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Multi-page: the admin dashboard (index.html) and the standalone JH preview
// (preview.html) — both vanilla, pulling from src/widget + src/shared.
// `npm run dev` serves both; `npm run build` emits both. Built under
// /appearance/ for GitHub Pages (https://getskibots.github.io/appearance/);
// dev stays at '/'.
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
      },
    },
  },
}));
