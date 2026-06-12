import { OPENINGS } from "../data/openings";

export interface DetectedOpening {
  name: string;
  eco: string;
  matchedMoves: number;
}

function countPrefixMatch(actual: string[], reference: string[]): number {
  let count = 0;
  for (let i = 0; i < reference.length && i < actual.length; i++) {
    if (actual[i] !== reference[i]) break;
    count++;
  }
  return count;
}

export function detectOpening(uciMoves: string[]): DetectedOpening | null {
  if (uciMoves.length < 2) return null;

  let bestMatch: DetectedOpening | null = null;
  let bestLen = 1;

  for (const opening of OPENINGS) {
    const mainLen = countPrefixMatch(uciMoves, opening.moves);
    if (mainLen > bestLen) {
      bestLen = mainLen;
      bestMatch = { name: opening.name, eco: opening.eco, matchedMoves: mainLen };
    }

    if (opening.variations) {
      for (const variation of opening.variations) {
        const varLen = countPrefixMatch(uciMoves, variation.moves);
        if (varLen > bestLen) {
          bestLen = varLen;
          bestMatch = {
            name: `${opening.name} — ${variation.name}`,
            eco: variation.eco ?? opening.eco,
            matchedMoves: varLen,
          };
        }
      }
    }
  }

  return bestMatch;
}
