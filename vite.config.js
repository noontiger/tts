import { defineConfig } from 'vite';

// GitHub Pages project site is served from /tts/
export default defineConfig({
  base: '/tts/',
  assetsInlineLimit: 0,
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 4000,
  },
});
