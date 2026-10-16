import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Stockfish runs in a Web Worker from the `stockfish` package's single-threaded build.
 *
 * That build needs no SharedArrayBuffer (so no COOP/COEP headers) and defaults to
 * the classical evaluation, so there is no 40 MB network file to download — just a
 * ~25 KB script and a ~575 KB WASM binary. This plugin serves the two files at
 * /engine/ during development and copies them into the production bundle.
 */
function stockfishEngine(): Plugin {
  const sourceDir = path.resolve("node_modules/stockfish/src");
  const files: Record<string, { source: string; type: string }> = {
    "stockfish-16-single.js": { source: "stockfish-nnue-16-single.js", type: "text/javascript" },
    "stockfish-16-single.wasm": { source: "stockfish-nnue-16-single.wasm", type: "application/wasm" },
  };

  return {
    name: "ask-gm:stockfish-engine",
    configureServer(server) {
      server.middlewares.use("/engine", (req, res, next) => {
        const name = decodeURIComponent((req.url ?? "").split("?")[0].replace(/^\//, ""));
        if (!Object.hasOwn(files, name)) return next();
        res.setHeader("Content-Type", files[name].type);
        fs.createReadStream(path.join(sourceDir, files[name].source)).pipe(res);
      });
    },
    generateBundle() {
      for (const [fileName, { source }] of Object.entries(files)) {
        this.emitFile({
          type: "asset",
          fileName: `engine/${fileName}`,
          source: fs.readFileSync(path.join(sourceDir, source)),
        });
      }
    },
  };
}

// The Express API runs separately in development; Vite forwards /api to it (dev server and `vite preview`).
const apiProxy = {
  "/api": {
    target: "http://localhost:3001",
    changeOrigin: true,
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), stockfishEngine()],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "server/**/*.test.js"],
  },
});
