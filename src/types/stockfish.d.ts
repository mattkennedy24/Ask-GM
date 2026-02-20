interface StockfishEngine {
  postMessage: (msg: string) => void;
  onmessage: ((event: string | { data: string }) => void) | null;
  terminate?: () => void;
}

declare module "stockfish" {
  const Stockfish: () => StockfishEngine;
  export default Stockfish;
}