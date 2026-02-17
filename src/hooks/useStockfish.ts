import { useEffect, useRef, useCallback, useState } from "react";

/**
 * Fallback: Lichess cloud evaluation API.
 * Free, no API key needed. Returns the best move for a given FEN.
 * https://lichess.org/api#tag/Analysis/operation/apiCloudEval
 */
async function fetchLichessEval(fen: string): Promise<string | null> {
  try {
    const encoded = encodeURIComponent(fen);
    const res = await fetch(
      `https://lichess.org/api/cloud-eval?fen=${encoded}&multiPv=1`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.pvs && data.pvs.length > 0 && data.pvs[0].moves) {
      // Lichess returns moves in UCI format, space-separated. First is best.
      return data.pvs[0].moves.split(" ")[0];
    }
    return null;
  } catch {
    return null;
  }
}

export function useStockfish() {
  const stockfishRef = useRef<any>(null);
  const [bestMove, setBestMove] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const wasmFailed = useRef(false);

  useEffect(() => {
    if (wasmFailed.current) return;

    try {
      // Dynamic import to avoid build-time issues with WASM
      import("stockfish")
        .then((mod) => {
          try {
            const sf = mod.default();
            sf.onmessage = (event: any) => {
              const msg =
                typeof event === "string" ? event : event?.data ?? "";
              if (typeof msg === "string" && msg.startsWith("bestmove")) {
                const move = msg.split(" ")[1];
                setBestMove(move);
                setThinking(false);
              }
            };
            stockfishRef.current = sf;
            sf.postMessage("uci");
          } catch {
            console.warn(
              "Stockfish WASM init failed — will use Lichess fallback",
            );
            wasmFailed.current = true;
            setUsingFallback(true);
          }
        })
        .catch(() => {
          console.warn(
            "Stockfish WASM import failed — will use Lichess fallback",
          );
          wasmFailed.current = true;
          setUsingFallback(true);
        });
    } catch {
      console.warn(
        "Stockfish WASM not available — will use Lichess fallback",
      );
      wasmFailed.current = true;
      setUsingFallback(true);
    }

    return () => {
      if (
        stockfishRef.current &&
        typeof stockfishRef.current.terminate === "function"
      ) {
        stockfishRef.current.terminate();
      }
    };
  }, []);

  const analyzePosition = useCallback(
    async (fen: string, depth = 15) => {
      setThinking(true);
      setBestMove(null);

      // Try local WASM engine first
      if (stockfishRef.current && !wasmFailed.current) {
        stockfishRef.current.postMessage("uci");
        stockfishRef.current.postMessage(`position fen ${fen}`);
        stockfishRef.current.postMessage(`go depth ${depth}`);
        return; // Result arrives via onmessage callback
      }

      // Fallback to Lichess cloud evaluation
      setUsingFallback(true);
      const move = await fetchLichessEval(fen);
      setBestMove(move);
      setThinking(false);
    },
    [],
  );

  return { bestMove, analyzePosition, thinking, usingFallback };
}
