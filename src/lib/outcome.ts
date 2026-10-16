import { Chess } from "chess.js";

export type GameOutcome =
  | { kind: "checkmate"; winner: "white" | "black" }
  | { kind: "stalemate" }
  | { kind: "draw"; reason: "insufficient material" | "the fifty-move rule" };

/**
 * Whether the game is over in this position, and how.
 *
 * Threefold repetition cannot be told from a single position, so it is not reported;
 * the engine and the grandmasters simply keep treating such a position as playable.
 */
export function gameOutcome(fen: string): GameOutcome | null {
  try {
    const chess = new Chess(fen);
    if (chess.isCheckmate()) return { kind: "checkmate", winner: chess.turn() === "w" ? "black" : "white" };
    if (chess.isStalemate()) return { kind: "stalemate" };
    if (chess.isInsufficientMaterial()) return { kind: "draw", reason: "insufficient material" };
    if (chess.isDrawByFiftyMoves()) return { kind: "draw", reason: "the fifty-move rule" };
    return null;
  } catch {
    return null;
  }
}

/** A short headline for the result, e.g. "Checkmate · White wins". */
export function describeOutcome(outcome: GameOutcome): string {
  switch (outcome.kind) {
    case "checkmate":
      return `Checkmate · ${outcome.winner === "white" ? "White" : "Black"} wins`;
    case "stalemate":
      return "Stalemate · draw";
    case "draw":
      return `Draw · ${outcome.reason}`;
  }
}

/** The share of the evaluation bar White owns once the game is over: all, none, or half. */
export function outcomeWhiteShare(outcome: GameOutcome): number {
  if (outcome.kind === "checkmate") return outcome.winner === "white" ? 100 : 0;
  return 50;
}
