import { Chess } from "chess.js";
import { type Ply, START_PLY } from "./lines";

/**
 * The game being played on the board: every position reached, and which one is
 * on screen. Navigating back and then moving replaces the abandoned future.
 *
 * Positions, SAN and UCI live together in one array so they can never drift out
 * of step (the previous version kept three parallel arrays plus a mutable Chess
 * instance, which went stale after navigation).
 */
export interface GameState {
  plies: Ply[];
  index: number;
}

export const INITIAL_GAME: GameState = { plies: [START_PLY], index: 0 };

export const currentPly = (state: GameState): Ply => state.plies[state.index];

/** Play a move from the position on screen. Returns null when it is not legal there. */
export function playMove(state: GameState, from: string, to: string, promotion?: string): GameState | null {
  const chess = new Chess(currentPly(state).fen);
  let move;
  try {
    move = chess.move({ from, to, promotion });
  } catch {
    return null;
  }
  const ply: Ply = { fen: chess.fen(), san: move.san, uci: `${move.from}${move.to}${move.promotion ?? ""}` };
  return { plies: [...state.plies.slice(0, state.index + 1), ply], index: state.index + 1 };
}

/** Jump to a position, clamped to the ends of the game. */
export function goTo(state: GameState, index: number): GameState {
  const bounded = Math.min(Math.max(index, 0), state.plies.length - 1);
  return bounded === state.index ? state : { ...state, index: bounded };
}

/** Take back the last move: step back and discard what came after. */
export function undo(state: GameState): GameState {
  if (state.index === 0) return state;
  return { plies: state.plies.slice(0, state.index), index: state.index - 1 };
}
