import { useEffect, useMemo, useRef, useState } from "react";
import type { EngineLine } from "../engine/uci";
import type { Ply } from "../lib/lines";
import { EvalBook, type MoveVerdict, reviewMove } from "../lib/moveReview";

/**
 * A verdict for every move of the game on the board: element `i` judges the move that produced
 * `plies[i + 1]`, or is null while the engine has not searched both positions deeply enough.
 *
 * The engine only ever looks at the position on screen, so evaluations are collected as the player
 * moves and navigates, and a move is judged as soon as both of its positions are known.
 */
export function useMoveReviews(plies: readonly Ply[], engineFen: string | null, engineLines: readonly EngineLine[]): (MoveVerdict | null)[] {
  const book = useRef(new EvalBook());
  const [learned, setLearned] = useState(0);

  useEffect(() => {
    if (engineFen && book.current.record(engineFen, engineLines)) setLearned((count) => count + 1);
  }, [engineFen, engineLines]);

  // `learned` changes whenever the book does, which is what makes the verdicts worth recomputing.
  return useMemo(
    () => plies.slice(1).map((ply, i) => (ply.uci ? reviewMove(book.current, plies[i].fen, ply.fen, ply.uci) : null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `learned` is the signal that the book changed
    [plies, learned],
  );
}
