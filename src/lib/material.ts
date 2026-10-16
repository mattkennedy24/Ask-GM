import { Chess } from "chess.js";

export type CapturableType = "q" | "r" | "b" | "n" | "p";

export const PIECE_VALUES: Record<CapturableType, number> = { q: 9, r: 5, b: 3, n: 3, p: 1 };

const STARTING_COUNTS: Record<CapturableType, number> = { q: 1, r: 2, b: 2, n: 2, p: 8 };

/** Heaviest first, the order captured pieces are displayed in. */
export const DISPLAY_ORDER: readonly CapturableType[] = ["q", "r", "b", "n", "p"];

export interface MaterialSummary {
  /** Black pieces White has taken. */
  capturedByWhite: CapturableType[];
  /** White pieces Black has taken. */
  capturedByBlack: CapturableType[];
  /** White's material minus Black's, in pawns. */
  advantage: number;
}

/**
 * Captured pieces and the material balance, derived from a position alone.
 *
 * A promoted pawn is not a capture: any piece a side has beyond its starting
 * set must have come from a pawn, so those are subtracted from the pawns it
 * appears to have lost.
 */
export function summarizeMaterial(fen: string): MaterialSummary {
  const counts = { w: { q: 0, r: 0, b: 0, n: 0, p: 0 }, b: { q: 0, r: 0, b: 0, n: 0, p: 0 } };
  try {
    for (const row of new Chess(fen).board()) {
      for (const piece of row) {
        if (piece && piece.type !== "k") counts[piece.color][piece.type]++;
      }
    }
  } catch {
    return { capturedByWhite: [], capturedByBlack: [], advantage: 0 };
  }

  const lost = (color: "w" | "b"): Record<CapturableType, number> => {
    const own = counts[color];
    const promoted = DISPLAY_ORDER.filter((t) => t !== "p").reduce((sum, t) => sum + Math.max(0, own[t] - STARTING_COUNTS[t]), 0);
    return {
      q: Math.max(0, STARTING_COUNTS.q - own.q),
      r: Math.max(0, STARTING_COUNTS.r - own.r),
      b: Math.max(0, STARTING_COUNTS.b - own.b),
      n: Math.max(0, STARTING_COUNTS.n - own.n),
      p: Math.max(0, STARTING_COUNTS.p - own.p - promoted),
    };
  };

  const expand = (missing: Record<CapturableType, number>) =>
    DISPLAY_ORDER.flatMap((type) => Array<CapturableType>(missing[type]).fill(type));

  const total = (color: "w" | "b") => DISPLAY_ORDER.reduce((sum, type) => sum + counts[color][type] * PIECE_VALUES[type], 0);

  return {
    capturedByWhite: expand(lost("b")),
    capturedByBlack: expand(lost("w")),
    advantage: total("w") - total("b"),
  };
}
