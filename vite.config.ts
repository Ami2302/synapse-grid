import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' → the built site works from any sub-path, e.g. https://<user>.github.io/<repo>/
// v2 dev server runs on its own port so it can sit next to the original project (5173)
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5175, strictPort: false },
})
