import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';


const asciiOnly = (): Plugin => ({
  name: 'ascii-only',
  enforce: 'post',
  // Chrome may decode extension scripts as Latin-1; escape non-ASCII so text like "..." renders correctly.
  generateBundle(_o, bundle) {
    for (const f of Object.values(bundle)) if (f.type === 'chunk') f.code = f.code.replace(/[^\x00-\x7f]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  },
});
// Main build: dashboard (index.html, also the extension options page), popup, background service worker.
// The content script is built separately (vite.content.config.ts) as a classic IIFE script.
export default defineConfig({
  plugins: [react(), tailwindcss(), asciiOnly()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        index: 'index.html',
        popup: 'popup.html',
        background: 'src/background/background.ts',
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
});
