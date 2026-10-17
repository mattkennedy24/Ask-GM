import { useCallback, useRef, useState } from "react";
import type { EngineLine } from "../engine/uci";
import { EvalBook } from "../lib/moveReview";

/**
 * The engine's evaluations of every position seen so far, shared by everything that judges moves.
 * `version` changes whenever the book learns something, so dependent values know to recompute.
 */
export function useEvalBook() {
  const book = useRef(new EvalBook()).current;
  const [version, setVersion] = useState(0);

  const record = useCallback(
    (fen: string, lines: readonly EngineLine[]) => {
      if (book.record(fen, lines)) setVersion((count) => count + 1);
    },
    [book],
  );

  return { book, version, record };
}
