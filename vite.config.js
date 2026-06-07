import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Served from https://kellerleonard79-ai.github.io/phssga/ — assets must
  // resolve under the repo subpath, not the domain root.
  base: '/phssga/',
  plugins: [react(), tailwindcss()],
})
