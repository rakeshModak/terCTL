import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

// Tauri needs a fixed dev port and expects Vite not to clear the screen.
// https://tauri.app/start/frontend/vite/
export default defineConfig({
  // TanStack Router plugin must come before the React plugin.
  plugins: [TanStackRouterVite({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],

  // Prevent Vite from obscuring Rust errors
  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,
    // don't rebuild the frontend when the Rust side changes
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },

  // Expose TAURI_ env vars to the frontend
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
})
