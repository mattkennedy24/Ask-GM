import { OPENINGS, type Opening } from "../data/openings";

export interface DetectedOpening {
  name: string;
  eco: string;
  /** How many of the game's moves agree with the matched line. */
  matchedMoves: number;
}

interface Line {
  opening: Opening;
  /** null for the opening's main line */
  variation: string | null;
  eco: string;
  moves: readonly string[];
}

const ALL_LINES: readonly Line[] = OPENINGS.flatMap((opening) => [
  { opening, variation: null, eco: opening.eco, moves: opening.moves },
  ...(opening.variations ?? []).map((v) => ({
    opening,
    variation: v.name,
    eco: v.eco ?? opening.eco,
    moves: v.moves,
  })),
]);

function sharedPrefixLength(a: readonly string[], b: readonly string[]): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

/**
 * Name the opening a game is following, from its UCI moves.
 *
 * The game is compared with every lesson line and the one it follows longest
 * wins. If several *different* openings follow the game equally far — after
 * 1.e4 e5 2.Nf3 that is the Ruy Lopez, Italian, Petroff and more — the game has not
 * committed yet, so nothing is claimed. (The earlier version returned whichever of
 * them came first in the list, i.e. "Ruy Lopez" after three plies.)
 */
export function detectOpening(uciMoves: readonly string[], lines: readonly Line[] = ALL_LINES): DetectedOpening | null {
  if (uciMoves.length < 2) return null;

  let best = 0;
  let candidates: Line[] = [];
  for (const line of lines) {
    const matched = sharedPrefixLength(uciMoves, line.moves);
    if (matched > best) {
      best = matched;
      candidates = [line];
    } else if (matched === best && matched > 0) {
      candidates.push(line);
    }
  }

  if (best < 2 || new Set(candidates.map((c) => c.opening)).size !== 1) return null;

  const { opening } = candidates[0];
  // Still inside the main line (or a shared stem): name the opening itself.
  if (candidates.some((c) => c.variation === null) || candidates.length > 1) {
    return { name: opening.name, eco: opening.eco, matchedMoves: best };
  }
  // Only one sub-variation follows the game this far: name it.
  const [only] = candidates;
  return { name: `${opening.name} — ${only.variation}`, eco: only.eco, matchedMoves: best };
}
