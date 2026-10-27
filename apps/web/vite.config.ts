import { copyFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

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

// One .env at the repo root serves both the server and the web app; only VITE_* vars reach the browser.
const envDir = path.resolve(import.meta.dirname, '../..')

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '')
  // In development, /api goes to the local server (api mode), on the server's PORT unless overridden.
  const apiProxy = env.DEV_API_PROXY || `http://localhost:${env.PORT || 3000}`

  return {
    envDir,
    // GitHub Pages serves the site from /<repo>/; CI sets BASE_PATH. Locally it's "/".
    base: process.env.BASE_PATH ?? '/',
    plugins: [react(), tailwindcss(), spaFallback()],
    server: {
      proxy: { '/api': { target: apiProxy, changeOrigin: true } },
    },
    build: {
      // The sample export is fetched from public/sample/ at runtime, not bundled.
      // The entry chunk is still ~550 KB (React, Radix, Recharts), hence the raised limit.
      chunkSizeWarningLimit: 800,
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
  }
})
