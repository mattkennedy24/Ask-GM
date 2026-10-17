import { useMemo } from "react";
import type { Ply } from "../lib/lines";
import { type EvalBook, type MoveVerdict, reviewMove } from "../lib/moveReview";

/**
 * A verdict for every move of the game on the board: element `i` judges the move that produced
 * `plies[i + 1]`, or is null while the engine has not searched both positions deeply enough.
 *
 * `version` is the signal that the book has learned something (see useEvalBook), so the verdicts
 * are worked out again.
 */
export function useMoveReviews(plies: readonly Ply[], book: EvalBook, version: number): (MoveVerdict | null)[] {
  return useMemo(
    () => plies.slice(1).map((ply, i) => (ply.uci ? reviewMove(book, plies[i].fen, ply.fen, ply.uci) : null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` is what tells us the book changed
    [plies, book, version],
  );
}
