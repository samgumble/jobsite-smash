import { defineConfig } from 'vite'

// Relative base so the build works under any GitHub Pages project path
// (username.github.io/<repo>/) and also when embedded in an iframe.
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 1500, // physics WASM + three are inherently large
  },
})
