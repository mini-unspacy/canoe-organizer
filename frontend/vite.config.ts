import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "convex/_generated": path.resolve(__dirname, "../convex/_generated"),
    },
  },
  server: {
    host: true,
    fs: {
      allow: ['..', '.']
    }
  },
  optimizeDeps: {
    exclude: ["convex", "convex/react"],
  },
})
