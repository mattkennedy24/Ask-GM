import { Chess } from "chess.js";
import { type EngineLine, MATE_SCORE } from "../engine/uci";
import { gameOutcome } from "./outcome";

/**
 * "How good was the move that was just played?"
 *
 * The engine's evaluation of the position before a move and of the position after it say how
 * much the move gave away. Evaluations are converted to the chance of winning (a logistic curve,
 * so 1 pawn matters a lot in an equal position and very little when already +8), and the drop in
 * that chance, from the mover's side, is the verdict — the same idea Lichess uses.
 *
 * Nothing here guesses: a move is only judged when both positions have been searched deeply
 * enough, otherwise there is simply no verdict.
 */

export type MoveQuality = "best" | "good" | "inaccuracy" | "mistake" | "blunder";

/** What the engine thought of one position, from White's point of view. */
export interface EvalSnapshot {
  score: number;
  depth: number;
  /** The engine's favourite move there, in UCI. */
  bestMove: string | null;
}

export interface MoveVerdict {
  quality: MoveQuality;
  /** Centipawns of evaluation the move gave up (0 or more). */
  lossCp: number;
  /** The engine's preferred move in the position before the move, in UCI. */
  bestMove: string | null;
}

/** A position searched shallower than this is too unreliable to judge a move by. */
export const MIN_REVIEW_DEPTH = 12;

/** Terminal positions have no search; they count as fully "searched". */
const TERMINAL_DEPTH = 99;

const WIN_CHANCE_SLOPE = 0.00368208;

/** Chance of winning for the side whose score this is: -1 (certain loss) to +1 (certain win). */
export function winChance(centipawns: number): number {
  return 2 / (1 + Math.exp(-WIN_CHANCE_SLOPE * centipawns)) - 1;
}

// Drop in win chance (on the -1..+1 scale) at which a move earns each label.
const THRESHOLDS = { inaccuracy: 0.1, mistake: 0.2, blunder: 0.3 } as const;

const positionKey = (fen: string) => fen.split(" ").slice(0, 4).join(" ");

/** How a finished game scores for White, or null while it is still going. */
function terminalScore(fen: string): number | null {
  const outcome = gameOutcome(fen);
  if (!outcome) return null;
  if (outcome.kind === "checkmate") return outcome.winner === "white" ? MATE_SCORE : -MATE_SCORE;
  return 0;
}

/** The deepest evaluation seen for each position, so stepping back through a game re-uses earlier analysis. */
export class EvalBook {
  private readonly byPosition = new Map<string, EvalSnapshot>();

  /** Remember the engine's top line for `fen`. Returns true when this improved what was known. */
  record(fen: string, lines: readonly EngineLine[]): boolean {
    const top = lines[0];
    if (!top || top.score === null || top.depth === undefined) return false;

    const key = positionKey(fen);
    const known = this.byPosition.get(key);
    if (known && known.depth >= top.depth) return false;
    this.byPosition.set(key, { score: top.score, depth: top.depth, bestMove: top.pv[0] ?? null });
    return true;
  }

  lookup(fen: string): EvalSnapshot | null {
    const terminal = terminalScore(fen);
    if (terminal !== null) return { score: terminal, depth: TERMINAL_DEPTH, bestMove: null };
    return this.byPosition.get(positionKey(fen)) ?? null;
  }
}

/**
 * Judge the move `playedUci` that took the game from `beforeFen` to `afterFen`.
 * Returns null until both positions have been evaluated deeply enough.
 */
export function reviewMove(book: EvalBook, beforeFen: string, afterFen: string, playedUci: string): MoveVerdict | null {
  const before = book.lookup(beforeFen);
  const after = book.lookup(afterFen);
  if (!before || !after) return null;
  if (before.depth < MIN_REVIEW_DEPTH || after.depth < MIN_REVIEW_DEPTH) return null;

  const sign = beforeFen.split(" ")[1] === "b" ? -1 : 1;
  const moverBefore = before.score * sign;
  const moverAfter = after.score * sign;
  const drop = winChance(moverBefore) - winChance(moverAfter);
  const lossCp = Math.max(0, Math.round(moverBefore - moverAfter));
  const bestMove = before.bestMove;

  let quality: MoveQuality;
  // "Best" means the engine's own choice; an equal alternative is merely "good".
  if (bestMove === playedUci) quality = "best";
  else if (drop < THRESHOLDS.inaccuracy) quality = "good";
  else if (drop < THRESHOLDS.mistake) quality = "inaccuracy";
  else if (drop < THRESHOLDS.blunder) quality = "mistake";
  else quality = "blunder";

  return { quality, lossCp: quality === "best" || quality === "good" ? Math.min(lossCp, 100) : lossCp, bestMove };
}

/** The chess-book mark for a verdict: "?!", "?" or "??". Sound moves get none. */
export function verdictGlyph(quality: MoveQuality): string {
  if (quality === "inaccuracy") return "?!";
  if (quality === "mistake") return "?";
  if (quality === "blunder") return "??";
  return "";
}

const WORDS: Record<MoveQuality, string> = {
  best: "Best move",
  good: "Good move",
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder",
};

export function verdictLabel(quality: MoveQuality): string {
  return WORDS[quality];
}

/** The engine's preferred move as SAN in the position before the move, if it differs from the move played. */
export function preferredSan(beforeFen: string, verdict: MoveVerdict, playedUci: string): string | null {
  if (!verdict.bestMove || verdict.bestMove === playedUci) return null;
  try {
    const move = new Chess(beforeFen).move({
      from: verdict.bestMove.slice(0, 2),
      to: verdict.bestMove.slice(2, 4),
      promotion: verdict.bestMove[4],
    });
    return move.san;
  } catch {
    return null;
  }
}

/** "−1.8" style size of what a move gave up, in pawns; capped so a missed mate does not print 99.0. */
export function formatLoss(lossCp: number): string {
  if (lossCp >= 1000) return "10+";
  return (lossCp / 100).toFixed(1);
}
