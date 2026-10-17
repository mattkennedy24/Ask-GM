import type { MoveVerdict } from "./moveReview";

/**
 * What a whole-game review adds up to: how many moves each side got wrong, and which moves to go back to.
 * `verdicts[i]` judges ply `i + 1` (White moves on odd plies).
 */

export interface SideSummary {
  /** Moves of this side that have a verdict. */
  judged: number;
  inaccuracy: number;
  mistake: number;
  blunder: number;
}

export interface ReviewSummary {
  white: SideSummary;
  black: SideSummary;
  /** The plies of every inaccuracy, mistake and blunder, in game order. */
  critical: number[];
}

const empty = (): SideSummary => ({ judged: 0, inaccuracy: 0, mistake: 0, blunder: 0 });

export function summarizeReview(verdicts: readonly (MoveVerdict | null)[]): ReviewSummary {
  const white = empty();
  const black = empty();
  const critical: number[] = [];

  verdicts.forEach((verdict, i) => {
    if (!verdict) return;
    const ply = i + 1;
    const side = ply % 2 === 1 ? white : black;
    side.judged++;
    if (verdict.quality === "inaccuracy" || verdict.quality === "mistake" || verdict.quality === "blunder") {
      side[verdict.quality]++;
      critical.push(ply);
    }
  });
  return { white, black, critical };
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** "1 blunder, 2 inaccuracies", or "no mistakes" when the side played cleanly. */
export function describeSide(side: SideSummary): string {
  if (side.judged === 0) return "not judged";
  const parts: string[] = [];
  if (side.blunder) parts.push(plural(side.blunder, "blunder"));
  if (side.mistake) parts.push(plural(side.mistake, "mistake"));
  if (side.inaccuracy) parts.push(side.inaccuracy === 1 ? "1 inaccuracy" : `${side.inaccuracy} inaccuracies`);
  return parts.length ? parts.join(", ") : "no mistakes";
}

/** The next flagged ply after `current`, wrapping round to the first; null when nothing was flagged. */
export function nextCritical(critical: readonly number[], current: number): number | null {
  if (critical.length === 0) return null;
  return critical.find((ply) => ply > current) ?? critical[0];
}

export const MAX_REVIEWED_MOVES = 10;

export interface ReviewedMove {
  ply: number;
  quality: "inaccuracy" | "mistake" | "blunder";
  lossCp: number;
  bestMove: string | null;
}

/**
 * The costliest flagged moves up to `upToPly`, in game order: what the coach is told about the game so far.
 * Moves after the position on screen are left out; the coach only knows the game up to there.
 */
export function reviewedMoves(verdicts: readonly (MoveVerdict | null)[], upToPly: number): ReviewedMove[] {
  const flagged: ReviewedMove[] = [];
  verdicts.forEach((verdict, i) => {
    const ply = i + 1;
    if (!verdict || ply > upToPly) return;
    if (verdict.quality === "inaccuracy" || verdict.quality === "mistake" || verdict.quality === "blunder") {
      flagged.push({ ply, quality: verdict.quality, lossCp: verdict.lossCp, bestMove: verdict.bestMove });
    }
  });
  return flagged
    .sort((a, b) => b.lossCp - a.lossCp)
    .slice(0, MAX_REVIEWED_MOVES)
    .sort((a, b) => a.ply - b.ply);
}
