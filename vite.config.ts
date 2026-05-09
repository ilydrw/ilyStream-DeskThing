import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'

// Car Thing runs an old WebView (Chromium 69ish), so we target accordingly
// and inline CSS into JS so DeskThing's single-bundle loader picks it up.
export default defineConfig({
  plugins: [react(), cssInjectedByJsPlugin()],
  base: './',
  server: {
    port: 3000
  },
  build: {
    target: 'chrome69',
    outDir: 'dist',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
})
