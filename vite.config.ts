import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy /api requests to the Express backend during development
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  // The stockfish WASM package doesn't have proper ESM exports for Rollup.
  // Exclude it from the bundle — the useStockfish hook loads it dynamically
  // and falls back to the Lichess cloud eval API if it fails.
  build: {
    rollupOptions: {
      external: ["stockfish"],
    },
  },
  optimizeDeps: {
    exclude: ["stockfish"],
  },
});
