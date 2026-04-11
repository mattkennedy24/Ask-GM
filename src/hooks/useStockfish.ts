import { useEffect, useRef, useCallback, useState } from "react";

export type EngineLineResult = {
  pv: string[];
  score: number | null;
  mate: number | null;
};

const MULTI_PV = 3;

/**
 * Lichess cloud evaluation API — returns top N lines.
 */
async function fetchLichessEval(fen: string): Promise<EngineLineResult[]> {
  try {
    const encoded = encodeURIComponent(fen);
    const res = await fetch(
      `https://lichess.org/api/cloud-eval?fen=${encoded}&multiPv=${MULTI_PV}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.pvs || data.pvs.length === 0) return [];

    return data.pvs.map((pv: { moves?: string; cp?: number; mate?: number }) => {
      const pvLine: string[] = pv.moves ? pv.moves.split(" ") : [];
      let score: number | null = null;
      let mate: number | null = null;
      if (pv.cp !== undefined) score = pv.cp;
      else if (pv.mate !== undefined) {
        mate = pv.mate;
        score = pv.mate > 0 ? 9999 : -9999;
      }
      return { pv: pvLine, score, mate };
    });
  } catch {
    return [];
  }
}

/**
 * Parse a Stockfish WASM "info" line for score and PV.
 * Example: "info depth 20 multipv 1 score cp 35 ... pv e2e4 e7e5 g1f3"
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
  const [topLines, setTopLines] = useState<EngineLineResult[]>([]);
  const [thinking, setThinking] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const wasmFailed = useRef(false);

  // Per-multipv accumulator: key = multipv index (1-based)
  const bestInfoMapRef = useRef<Map<number, { score: number | null; mate: number | null; pv: string[] }>>(new Map());

  // Backwards-compatible derived values from topLines[0]
  const firstLine = topLines[0] ?? null;
  const bestMove = firstLine?.pv[0] ?? null;
  const evalScore = firstLine?.score ?? null;
  const mateIn = firstLine?.mate ?? null;
  const pvLine = firstLine?.pv ?? [];

  useEffect(() => {
    if (wasmFailed.current) return;

    try {
      import("stockfish")
        .then((mod) => {
          try {
            const sf = mod.default();
            sf.onmessage = (event: string | { data: string }) => {
              const msg: string = typeof event === "string" ? event : (event?.data ?? "");
              if (typeof msg !== "string") return;

              if (msg.startsWith("info") && msg.includes("score")) {
                // Extract which PV line this info belongs to (defaults to 1 when MultiPV not set)
                const multipvMatch = msg.match(/\bmultipv (\d+)/);
                const multipvIdx = multipvMatch ? parseInt(multipvMatch[1], 10) : 1;
                const parsed = parseInfoLine(msg);
                if (parsed.score !== null || parsed.mate !== null) {
                  bestInfoMapRef.current.set(multipvIdx, parsed);
                }
              }

              if (msg.startsWith("bestmove")) {
                const move = msg.split(" ")[1];
                const map = bestInfoMapRef.current;

                const lines: EngineLineResult[] = Array.from(map.entries())
                  .sort(([a], [b]) => a - b)
                  .map(([, info]) => ({ score: info.score, mate: info.mate, pv: info.pv }))
                  .filter((l) => l.pv.length > 0);

                // Fallback: if map is empty, at least use the bestmove
                if (lines.length === 0 && move && move !== "(none)") {
                  lines.push({ score: null, mate: null, pv: [move] });
                }

                setTopLines(lines);
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
    setTopLines([]);
    bestInfoMapRef.current = new Map();

    if (stockfishRef.current && !wasmFailed.current) {
      stockfishRef.current.postMessage("stop");
      stockfishRef.current.postMessage("ucinewgame");
      stockfishRef.current.postMessage(`setoption name MultiPV value ${MULTI_PV}`);
      stockfishRef.current.postMessage(`position fen ${fen}`);
      stockfishRef.current.postMessage(`go depth ${depth}`);
      return;
    }

    setUsingFallback(true);
    const lines = await fetchLichessEval(fen);
    setTopLines(lines);
    setThinking(false);
  }, []);

  return { bestMove, evalScore, mateIn, pvLine, topLines, analyzePosition, thinking, usingFallback };
}
