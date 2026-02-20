import { useEffect, useRef, useCallback, useState } from "react";

export type EvalResult = {
  bestMove: string | null;
  /** Centipawns from white's perspective, or ±9999 for forced mate. Null if unknown. */
  evalScore: number | null;
  /** "M3" / "M-3" etc when a forced mate is found, otherwise null. */
  mateIn: number | null;
  /** Full PV line as UCI moves (e.g. ["e2e4", "e7e5", ...]). */
  pvLine: string[];
};

/**
 * Lichess cloud evaluation API.
 * Free, no API key. Returns best move, eval, and PV.
 * https://lichess.org/api#tag/Analysis/operation/apiCloudEval
 */
async function fetchLichessEval(fen: string): Promise<EvalResult> {
  const empty: EvalResult = { bestMove: null, evalScore: null, mateIn: null, pvLine: [] };
  try {
    const encoded = encodeURIComponent(fen);
    const res = await fetch(
      `https://lichess.org/api/cloud-eval?fen=${encoded}&multiPv=1`
    );
    if (!res.ok) return empty;
    const data = await res.json();
    if (!data.pvs || data.pvs.length === 0) return empty;

    const pv = data.pvs[0];
    const pvLine: string[] = pv.moves ? pv.moves.split(" ") : [];
    const bestMove = pvLine[0] ?? null;

    let evalScore: number | null = null;
    let mateIn: number | null = null;

    if (pv.cp !== undefined) {
      evalScore = pv.cp;
    } else if (pv.mate !== undefined) {
      mateIn = pv.mate;
      evalScore = pv.mate > 0 ? 9999 : -9999;
    }

    return { bestMove, evalScore, mateIn, pvLine };
  } catch {
    return empty;
  }
}

/**
 * Parse a Stockfish WASM "info" line for score and PV.
 * Example: "info depth 20 ... score cp 35 ... pv e2e4 e7e5 g1f3"
 */
function parseInfoLine(msg: string): { score: number | null; mate: number | null; pv: string[] } {
  let score: number | null = null;
  let mate: number | null = null;

  const cpMatch = msg.match(/score cp (-?\d+)/);
  const mateMatch = msg.match(/score mate (-?\d+)/);

  if (cpMatch) score = parseInt(cpMatch[1], 10);
  else if (mateMatch) {
    mate = parseInt(mateMatch[1], 10);
    score = mate > 0 ? 9999 : -9999;
  }

  const pvMatch = msg.match(/ pv (.+?)(?:\s+(?:bm|multipv|string|currmove)\b|$)/);
  const pv = pvMatch ? pvMatch[1].trim().split(/\s+/) : [];

  return { score, mate, pv };
}

export function useStockfish() {
  const stockfishRef = useRef<{ postMessage: (msg: string) => void; terminate?: () => void } | null>(null);
  const [bestMove, setBestMove] = useState<string | null>(null);
  const [evalScore, setEvalScore] = useState<number | null>(null);
  const [mateIn, setMateIn] = useState<number | null>(null);
  const [pvLine, setPvLine] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const wasmFailed = useRef(false);

  // Accumulate the best info line seen during WASM analysis
  const bestInfoRef = useRef<{ score: number | null; mate: number | null; pv: string[] }>({
    score: null,
    mate: null,
    pv: [],
  });

  useEffect(() => {
    if (wasmFailed.current) return;

    try {
      import("stockfish")
        .then((mod) => {
          try {
            const sf = mod.default();
            sf.onmessage = (event: string | { data: string }) => {
              const msg: string =
                typeof event === "string" ? event : (event?.data ?? "");

              if (typeof msg !== "string") return;

              // Collect best analysis from info lines (track last best-depth info)
              if (msg.startsWith("info") && msg.includes("score")) {
                const parsed = parseInfoLine(msg);
                // Only update if we got a score (avoids resetting on lowerbound lines)
                if (parsed.score !== null || parsed.mate !== null) {
                  bestInfoRef.current = parsed;
                }
              }

              if (msg.startsWith("bestmove")) {
                const move = msg.split(" ")[1];
                const info = bestInfoRef.current;
                setBestMove(move === "(none)" ? null : (move ?? null));
                setEvalScore(info.score);
                setMateIn(info.mate);
                setPvLine(info.pv.length > 0 ? info.pv : move ? [move] : []);
                setThinking(false);
              }
            };
            stockfishRef.current = sf;
            sf.postMessage("uci");
          } catch {
            console.warn("Stockfish WASM init failed — will use Lichess fallback");
            wasmFailed.current = true;
            setUsingFallback(true);
          }
        })
        .catch(() => {
          console.warn("Stockfish WASM import failed — will use Lichess fallback");
          wasmFailed.current = true;
          setUsingFallback(true);
        });
    } catch {
      console.warn("Stockfish WASM not available — will use Lichess fallback");
      wasmFailed.current = true;
      setUsingFallback(true);
    }

    return () => {
      if (stockfishRef.current && typeof stockfishRef.current.terminate === "function") {
        stockfishRef.current.terminate();
      }
    };
  }, []);

  const analyzePosition = useCallback(async (fen: string, depth = 18) => {
    setThinking(true);
    setBestMove(null);
    setEvalScore(null);
    setMateIn(null);
    setPvLine([]);
    bestInfoRef.current = { score: null, mate: null, pv: [] };

    // Try local WASM engine first
    if (stockfishRef.current && !wasmFailed.current) {
      stockfishRef.current.postMessage("stop");
      stockfishRef.current.postMessage("ucinewgame");
      stockfishRef.current.postMessage(`position fen ${fen}`);
      stockfishRef.current.postMessage(`go depth ${depth}`);
      return; // Result arrives via onmessage callback
    }

    // Fallback to Lichess cloud evaluation
    setUsingFallback(true);
    const result = await fetchLichessEval(fen);
    setBestMove(result.bestMove);
    setEvalScore(result.evalScore);
    setMateIn(result.mateIn);
    setPvLine(result.pvLine);
    setThinking(false);
  }, []);

  return { bestMove, evalScore, mateIn, pvLine, analyzePosition, thinking, usingFallback };
}
