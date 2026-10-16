import { Chess } from "chess.js";

/** One position in a line of play. `positions[0]` of any line is the starting position. */
export interface Ply {
  fen: string;
  /** The move that led here in SAN (null for the starting position). */
  san: string | null;
  /** The same move in UCI, e.g. "e2e4" or "a7a8q" (null for the starting position). */
  uci: string | null;
}

export const START_FEN = new Chess().fen();

export const START_PLY: Ply = { fen: START_FEN, san: null, uci: null };

/**
 * Replay UCI moves from the start. Returns the starting position followed by the
 * position after each move, stopping at the first move that is not legal so a
 * corrupt line can never produce a position that was not actually reachable.
 */
export function buildPositions(uciMoves: readonly string[]): Ply[] {
  const chess = new Chess();
  const plies: Ply[] = [START_PLY];
  for (const uci of uciMoves) {
    try {
      const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      plies.push({ fen: chess.fen(), san: move.san, uci });
    } catch {
      break;
    }
  }
  return plies;
}

/** The from/to squares of the move that produced a position, for highlighting. */
export function moveSquares(ply: Ply | undefined): { from: string; to: string } | null {
  if (!ply?.uci) return null;
  return { from: ply.uci.slice(0, 2), to: ply.uci.slice(2, 4) };
}

/** SAN moves played to reach `plies[index]`, in order. */
export function sanUpTo(plies: readonly Ply[], index: number): string[] {
  return plies
    .slice(1, index + 1)
    .map((ply) => ply.san)
    .filter((san): san is string => san !== null);
}

/** UCI moves played to reach `plies[index]`, in order. */
export function uciUpTo(plies: readonly Ply[], index: number): string[] {
  return plies
    .slice(1, index + 1)
    .map((ply) => ply.uci)
    .filter((uci): uci is string => uci !== null);
}

/** The square of the king in check, if the side to move is in check. */
export function kingInCheckSquare(fen: string): string | null {
  try {
    const chess = new Chess(fen);
    if (!chess.inCheck()) return null;
    return chess.findPiece({ type: "k", color: chess.turn() })[0] ?? null;
  } catch {
    return null;
  }
}
