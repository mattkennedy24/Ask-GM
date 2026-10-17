// The engine files are copied from the `stockfish` package into /engine at build time (see vite.config.ts).
const ENGINE_SCRIPT = `${import.meta.env.BASE_URL}engine/stockfish-16-single.js`;
const ENGINE_WASM = `${import.meta.env.BASE_URL}engine/stockfish-16-single.wasm`;

/** A new Stockfish worker. Throws when the browser cannot run workers. */
export function createEngineWorker(): Worker {
  return new Worker(`${ENGINE_SCRIPT}#${encodeURIComponent(ENGINE_WASM)}`);
}
