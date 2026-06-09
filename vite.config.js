import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';

// Multi-page setup: the admin dashboard and the standalone JH preview are two
// vanilla entry HTML files that pull from src/widget + src/shared. `botscrew.html`
// is a third entry that mounts the React drop-in AppearanceTab for BotScrew.
// `npm run dev` serves all three; `npm run build` emits them.
// React (plugin + react/react-dom deps) is for the BotScrew dashboard component
// ONLY — the embeddable widget core stays framework-agnostic vanilla JS.
export default defineConfig(({ command }) => ({
  // Served at root locally; built under /appearance/ for GitHub Pages.
  base: command === 'build' ? '/appearance/' : '/',
  root: '.',
  plugins: [react()],
  server: {
    open: '/index.html',
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        dashboard: resolve(import.meta.dirname, 'index.html'),
        preview: resolve(import.meta.dirname, 'preview.html'),
        botscrew: resolve(import.meta.dirname, 'botscrew.html'),
      },
    },
  },
}));
