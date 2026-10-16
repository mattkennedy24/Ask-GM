import { useCallback, useMemo, useRef, useState } from "react";
import { currentPly, type GameState, goTo, INITIAL_GAME, playMove, undo } from "../lib/game";
import { moveSquares, sanUpTo, uciUpTo } from "../lib/lines";

/**
 * The game on the main board.
 *
 * `makeMove` has to answer synchronously (the board library asks "was that legal?"
 * the instant a piece is dropped), so it reads the latest state through a ref that is
 * updated in the same call. That also means a move made through any path — a drag, a
 * click, or a grandmaster's suggestion — always applies to the position actually on
 * screen, never to a stale render.
 */
export function useChessGame() {
  const [state, setState] = useState<GameState>(INITIAL_GAME);
  const stateRef = useRef(state);

  const commit = useCallback((next: GameState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const makeMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      const next = playMove(stateRef.current, from, to, promotion);
      if (!next) return false;
      commit(next);
      return true;
    },
    [commit],
  );

  const navigate = useCallback((index: number) => commit(goTo(stateRef.current, index)), [commit]);
  const back = useCallback(() => commit(goTo(stateRef.current, stateRef.current.index - 1)), [commit]);
  const forward = useCallback(() => commit(goTo(stateRef.current, stateRef.current.index + 1)), [commit]);
  const takeBack = useCallback(() => commit(undo(stateRef.current)), [commit]);
  const reset = useCallback(() => commit(INITIAL_GAME), [commit]);

  const ply = currentPly(state);
  const lists = useMemo(
    () => ({
      // The whole line, for the move list — including positions "in the future" after stepping back.
      sanMoves: sanUpTo(state.plies, state.plies.length - 1),
      // What the grandmaster is told: the moves that lead to the position on screen.
      playedSan: sanUpTo(state.plies, state.index),
      playedUci: uciUpTo(state.plies, state.index),
    }),
    [state],
  );

  return {
    fen: ply.fen,
    /** Index of the position on screen: 0 = start, n = after n plies. */
    index: state.index,
    plies: state.plies,
    lastMove: moveSquares(ply),
    ...lists,
    canBack: state.index > 0,
    canForward: state.index < state.plies.length - 1,
    makeMove,
    navigate,
    back,
    forward,
    takeBack,
    reset,
  };
}
