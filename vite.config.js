import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Deployed to the user site https://kellerleonard79-ai.github.io/ which is
  // served from the domain root, so the default base ('/') is correct.
  plugins: [react(), tailwindcss()],
})
