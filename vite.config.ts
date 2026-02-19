import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // stockfish v16 has an incorrect "main" in package.json — point directly
      // to the no-SIMD variant for broadest browser compatibility.
      stockfish: path.resolve(
        "./node_modules/stockfish/src/stockfish-nnue-16-no-simd.js",
      ),
    },
  },
  server: {
    // Proxy /api requests to the Express backend during development
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      external: ["stockfish"],
    },
  },
  optimizeDeps: {
    exclude: ["stockfish"],
  },
});
