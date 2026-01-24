import { useEffect, useRef, useCallback, useState } from "react";
import Stockfish from "stockfish";

export function useStockfish() {
  const stockfishRef = useRef<any>(null);
  const [bestMove, setBestMove] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    // Create Stockfish instance
    stockfishRef.current = Stockfish();
    stockfishRef.current.onmessage = (event: any) => {
      if (typeof event === "string" && event.startsWith("bestmove")) {
        const move = event.split(" ")[1];
        setBestMove(move);
        setThinking(false);
      }
    };
    return () => {
      if (stockfishRef.current && stockfishRef.current.terminate) {
        stockfishRef.current.terminate();
      }
    };
  }, []);

  const analyzePosition = useCallback((fen: string, depth = 15) => {
    setThinking(true);
    setBestMove(null);
    stockfishRef.current.postMessage("uci");
    stockfishRef.current.postMessage(`position fen ${fen}`);
    stockfishRef.current.postMessage(`go depth ${depth}`);
  }, []);

  return { bestMove, analyzePosition, thinking };
}