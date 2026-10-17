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

/** The result as chess scores it: "1-0", "0-1" or "1/2-1/2", written with a proper en dash and half sign. */
export function outcomeNotation(outcome: GameOutcome): string {
  if (outcome.kind === "checkmate") return outcome.winner === "white" ? "1\u20130" : "0\u20131";
  return "\u00bd\u2013\u00bd";
}

/** One word for the headline of a finished game. */
export function outcomeHeadline(outcome: GameOutcome): string {
  if (outcome.kind === "checkmate") return "Checkmate";
  return outcome.kind === "stalemate" ? "Stalemate" : "Draw";
}

/** A sentence that says who won, or why the game is drawn. */
export function outcomeDetail(outcome: GameOutcome): string {
  if (outcome.kind === "checkmate") return `${outcome.winner === "white" ? "White" : "Black"} wins.`;
  if (outcome.kind === "stalemate") return "No legal move, and no check: the game is drawn.";
  return outcome.reason === "insufficient material" ? "Neither side has the material to checkmate." : "Fifty moves without a capture or a pawn move.";
}
