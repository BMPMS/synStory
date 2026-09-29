import { fileURLToPath } from 'node:url'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  build: {
    rollupOptions: {
      // Two separate HTML entry points, not one router — the battery test
      // (test.html / TestApp.svelte) is its own standalone app sharing
      // this project's theme.js/global.css/fonts, not a route inside the
      // story's own App.svelte. Vite's dev server already serves any
      // .html file at its own path with no config; this input map is
      // only needed so `vite build` emits both pages, not just index.html.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        test: fileURLToPath(new URL('./test.html', import.meta.url))
      }
    }
  }
})
