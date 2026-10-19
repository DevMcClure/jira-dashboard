import { copyFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * GitHub Pages has no SPA fallback, so deep links like /tickets/PLAT-1 would 404.
 * Serving index.html as 404.html lets the router take over on any path.
 */
function spaFallback(): Plugin {
  let outDir = 'dist'
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      copyFileSync(path.join(outDir, 'index.html'), path.join(outDir, '404.html'))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the site from /<repo>/; CI sets BASE_PATH. Locally it's "/".
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss(), spaFallback()],
  build: {
    // The sample export (~290 KB JSON) is bundled into the entry chunk on purpose
    // so the POC works offline with zero setup; pages themselves are lazy-loaded.
    chunkSizeWarningLimit: 800,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
