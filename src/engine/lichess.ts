import { type EngineLine, MATE_SCORE } from "./uci";

/**
 * Lichess "cloud eval" — a cache of engine analysis for positions people have
 * already looked at. Used only as a fallback when the local engine cannot run
 * (no Worker/WASM support); it has no entry for most positions, so the local
 * engine remains the primary source.
 */
const CLOUD_EVAL_URL = "https://lichess.org/api/cloud-eval";
const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/** Lichess reports evaluations from White's point of view, which is also this app's convention. */
export function parseCloudEval(data: unknown): EngineLine[] {
  if (!data || typeof data !== "object") return [];
  const { pvs, depth } = data as { pvs?: unknown; depth?: unknown };
  if (!Array.isArray(pvs)) return [];

  const lines: EngineLine[] = [];
  for (const raw of pvs) {
    if (!raw || typeof raw !== "object") continue;
    const { moves, cp, mate } = raw as { moves?: unknown; cp?: unknown; mate?: unknown };
    const pv = typeof moves === "string" ? moves.split(" ").filter((move) => UCI_MOVE.test(move)) : [];
    if (pv.length === 0) continue;

    const lineDepth = typeof depth === "number" ? depth : undefined;
    if (typeof mate === "number") {
      lines.push({ pv, mate, score: mate > 0 ? MATE_SCORE : -MATE_SCORE, depth: lineDepth });
    } else if (typeof cp === "number") {
      lines.push({ pv, mate: null, score: cp, depth: lineDepth });
    }
  }
  return lines;
}

/** Resolves to no lines when the position is not cached or the request fails or is aborted. */
export async function fetchCloudEval(fen: string, multiPv: number, signal?: AbortSignal): Promise<EngineLine[]> {
  try {
    const response = await fetch(`${CLOUD_EVAL_URL}?fen=${encodeURIComponent(fen)}&multiPv=${multiPv}`, { signal });
    if (!response.ok) return [];
    return parseCloudEval(await response.json());
  } catch {
    return [];
  }
}
