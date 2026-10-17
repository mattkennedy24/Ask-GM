import { Chess } from "chess.js";
import type { GameState } from "./game";
import { type Ply, START_FEN } from "./lines";

/**
 * Turning pasted text into a game on the board.
 *
 * Two things are accepted: a PGN (the format every site exports; comments, variations and tags are
 * fine, only the main line is kept) and a single FEN position. Everything else is refused with a
 * message a person can act on. The size limits keep a stray paste from freezing the page.
 */

export const MAX_IMPORT_CHARS = 50_000;
export const MAX_IMPORT_PLIES = 600;

export type ImportResult = { ok: true; state: GameState; summary: string } | { ok: false; error: string };

// "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1": eight ranks, then the side to move.
const FEN_LIKE = /^[prnbqkPRNBQK1-8]+(?:\/[prnbqkPRNBQK1-8]+){7}\s+[wb]\b/;

const positionKey = (fen: string) => fen.split(" ").slice(0, 4).join(" ");

export function startsFromInitialPosition(state: GameState): boolean {
  return positionKey(state.plies[0].fen) === positionKey(START_FEN);
}

export function importGame(text: string): ImportResult {
  const input = text.trim();
  if (!input) return { ok: false, error: "Paste a game (PGN) or a position (FEN) first." };
  if (input.length > MAX_IMPORT_CHARS) return { ok: false, error: "That is too long to be a single game." };

  if (FEN_LIKE.test(input) && !input.includes("\n")) {
    try {
      const fen = new Chess(input).fen();
      return { ok: true, state: { plies: [{ fen, san: null, uci: null }], index: 0 }, summary: "Loaded the position." };
    } catch {
      return { ok: false, error: "That position is not legal. Check the FEN and try again." };
    }
  }

  const chess = new Chess();
  try {
    chess.loadPgn(input);
  } catch {
    return { ok: false, error: "Could not read that. Paste one game in PGN, or one position in FEN." };
  }

  const moves = chess.history({ verbose: true });
  if (moves.length === 0) {
    // A PGN with no moves can still carry a starting position in its FEN tag.
    const fen = chess.fen();
    if (positionKey(fen) !== positionKey(START_FEN)) {
      return { ok: true, state: { plies: [{ fen, san: null, uci: null }], index: 0 }, summary: "Loaded the position." };
    }
    return { ok: false, error: "No moves found. Paste a game that has at least one move." };
  }
  if (moves.length > MAX_IMPORT_PLIES) {
    return { ok: false, error: `That game has more than ${MAX_IMPORT_PLIES / 2} moves, which is more than this board will take.` };
  }

  const plies: Ply[] = [{ fen: moves[0].before, san: null, uci: null }];
  for (const move of moves) {
    plies.push({ fen: move.after, san: move.san, uci: `${move.from}${move.to}${move.promotion ?? ""}` });
  }
  const count = Math.ceil(moves.length / 2);
  return { ok: true, state: { plies, index: 0 }, summary: `Loaded a game of ${count} move${count === 1 ? "" : "s"}.` };
}

/** The whole line on the board as a PGN, ready to paste anywhere. */
export function exportPgn(state: GameState): string {
  const chess = new Chess(state.plies[0].fen);
  for (const ply of state.plies.slice(1)) {
    if (!ply.uci) continue;
    try {
      chess.move({ from: ply.uci.slice(0, 2), to: ply.uci.slice(2, 4), promotion: ply.uci[4] });
    } catch {
      break;
    }
  }
  return chess.pgn();
}
