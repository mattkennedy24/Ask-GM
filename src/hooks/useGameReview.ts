import { useCallback, useEffect, useRef, useState } from "react";
import { UciAnalyzer } from "../engine/analyzer";
import { IDLE_PROGRESS, type ReviewProgress, ReviewQueue } from "../engine/reviewQueue";
import type { EngineLine } from "../engine/uci";
import { createEngineWorker } from "../engine/worker";
import { type EvalBook, MIN_REVIEW_DEPTH } from "../lib/moveReview";

// One line per position, searched to a fixed depth, and nothing is published while it runs.
const REVIEW_ENGINE = { multiPv: 1, maxDepth: 14, moveTimeMs: 1200, hashMb: 16, minDepth: 999, throttleMs: 0 };

/**
 * A second, quiet Stockfish for judging moves.
 *
 * The main engine always looks at the position on screen. This one looks at the others: the position
 * before the move you just played (so it can be judged at once, however quickly you moved) and, on
 * request, every position of the game. Its results go into the shared evaluation book and nowhere else.
 * It is only started when there is something to look at.
 */
export function useGameReview(book: EvalBook, record: (fen: string, lines: readonly EngineLine[]) => void) {
  const [progress, setProgress] = useState<ReviewProgress>(IDLE_PROGRESS);
  const [unavailable, setUnavailable] = useState(false);
  const analyzer = useRef<UciAnalyzer | null>(null);
  const failed = useRef(false);

  // The latest callbacks, without making the queue depend on them.
  const recordRef = useRef(record);
  useEffect(() => {
    recordRef.current = record;
  });

  const queue = useRef<ReviewQueue | null>(null);
  if (queue.current === null) {
    queue.current = new ReviewQueue({
      start: (fen) => {
        if (!analyzer.current && !failed.current) {
          try {
            analyzer.current = new UciAnalyzer(
              createEngineWorker(),
              {
                onUpdate: (update) => {
                  if (!update.thinking) queue.current?.complete(update.fen, update.lines);
                },
                onError: () => {
                  failed.current = true;
                  analyzer.current = null;
                  setUnavailable(true);
                  queue.current?.cancel();
                },
              },
              REVIEW_ENGINE,
            );
          } catch {
            failed.current = true;
            setUnavailable(true);
          }
        }
        if (analyzer.current) analyzer.current.analyze(fen);
        else queue.current?.cancel();
      },
      stop: () => analyzer.current?.cancel(),
      isDone: (fen) => (book.lookup(fen)?.depth ?? 0) >= MIN_REVIEW_DEPTH,
      onResult: (fen, lines) => recordRef.current(fen, lines),
      onProgress: setProgress,
    });
  }

  useEffect(() => {
    const current = queue.current;
    return () => {
      current?.cancel();
      analyzer.current?.dispose();
      analyzer.current = null;
    };
  }, []);

  /** Judge these positions soon and quietly (the move you just played). */
  const ensure = useCallback((fens: readonly string[]) => queue.current?.add(fens, { urgent: true }), []);
  /** Search every one of these positions and report progress. */
  const scan = useCallback((fens: readonly string[]) => queue.current?.add(fens, { tracked: true }), []);
  const cancel = useCallback(() => queue.current?.cancel(), []);

  return { progress, unavailable, ensure, scan, cancel };
}
