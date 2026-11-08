import { defineConfig, type Plugin } from 'vite';


const asciiOnly = (): Plugin => ({
  name: 'ascii-only',
  enforce: 'post',
  // Chrome may decode extension scripts as Latin-1; escape non-ASCII so text like "..." renders correctly.
  generateBundle(_o, bundle) {
    for (const f of Object.values(bundle)) if (f.type === 'chunk') f.code = f.code.replace(/[^\x00-\x7f]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  },
});
// Content script is injected on demand with chrome.scripting, so it must be one self-contained classic script.
export default defineConfig({
  plugins: [asciiOnly()],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'src/content/content.ts',
      formats: ['iife'],
      name: 'ApplyPilotContent',
      fileName: () => 'content.js',
    },
  },
});
