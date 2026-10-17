/**
 * Pure helpers for the UCI protocol spoken by Stockfish.
 *
 * Kept free of React and of the Worker so they can be unit-tested directly.
 */

/** One principal variation. `score` and `mate` are always from White's point of view. */
export interface EngineLine {
  pv: string[];
  score: number | null;
  mate: number | null;
  depth?: number;
}

export interface UciInfo {
  multipv: number;
  depth: number;
  /** Raw UCI score: relative to the side to move. */
  score: { kind: "cp" | "mate"; value: number };
  bound: "lower" | "upper" | null;
  pv: string[];
}

/** Score used for forced mates so they sort and render as "very large" evaluations. */
export const MATE_SCORE = 9999;

const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/**
 * Parse an `info` line. Returns null for lines that carry no usable analysis
 * (`info string ...`, `info currmove ...`, lines without a score or a pv).
 *
 * Example: `info depth 14 seldepth 18 multipv 2 score cp 31 nodes 1234 pv b3c2 d5c4`
 */
export function parseInfoLine(line: string): UciInfo | null {
  if (!line.startsWith("info ") || line.startsWith("info string")) return null;

  const tokens = line.trim().split(/\s+/);
  let multipv = 1;
  let depth = 0;
  let score: UciInfo["score"] | null = null;
  let bound: UciInfo["bound"] = null;
  let pv: string[] = [];

  for (let i = 1; i < tokens.length; i++) {
    switch (tokens[i]) {
      case "depth":
        depth = Number.parseInt(tokens[++i], 10);
        break;
      case "multipv":
        multipv = Number.parseInt(tokens[++i], 10);
        break;
      case "score": {
        const kind = tokens[++i];
        const value = Number.parseInt(tokens[++i], 10);
        if ((kind === "cp" || kind === "mate") && Number.isFinite(value)) score = { kind, value };
        if (tokens[i + 1] === "lowerbound") bound = "lower";
        if (tokens[i + 1] === "upperbound") bound = "upper";
        break;
      }
      case "pv":
        pv = tokens.slice(i + 1).filter((move) => UCI_MOVE.test(move));
        i = tokens.length;
        break;
    }
  }

  if (!score || pv.length === 0 || !Number.isFinite(depth) || !Number.isFinite(multipv)) return null;
  return { multipv, depth, score, bound, pv };
}

/**
 * UCI scores are relative to the side to move; the rest of the app (eval bar,
 * labels, the grandmaster's prompt) uses White's point of view. Flip for Black.
 */
export function toWhitePerspective(info: UciInfo, turn: "w" | "b"): EngineLine {
  const sign = turn === "w" ? 1 : -1;
  if (info.score.kind === "mate") {
    const mate = info.score.value * sign;
    return { pv: info.pv, mate, score: mate > 0 ? MATE_SCORE : -MATE_SCORE, depth: info.depth };
  }
  return { pv: info.pv, mate: null, score: info.score.value * sign, depth: info.depth };
}

/** The move from a `bestmove` line, or null for "(none)" / malformed input. */
export function parseBestMove(line: string): string | null {
  if (!line.startsWith("bestmove")) return null;
  const move = line.split(/\s+/)[1];
  return move && UCI_MOVE.test(move) ? move : null;
}

/** Side to move from a FEN, defaulting to White for malformed input. */
export function turnFromFen(fen: string): "w" | "b" {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}
