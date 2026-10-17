/**
 * Presentation helpers for engine evaluations.
 *
 * Every score in the app is from White's point of view: positive favours White.
 * `mate` is the number of moves to mate, positive when White mates.
 */

export type EvalSide = "white" | "black" | "equal";

/** Whose favour an evaluation is in, or null when there is none yet. */
export function evalSide(score: number | null, mate: number | null): EvalSide | null {
  if (mate !== null) return mate > 0 ? "white" : "black";
  if (score === null) return null;
  if (Math.abs(score) < 25) return "equal";
  return score > 0 ? "white" : "black";
}

/** Short, side-explicit description: "Equal", "White edge", "Black better", "White winning". */
export function evalLabel(score: number | null, mate: number | null): string {
  if (mate !== null) return mate > 0 ? "White mates" : "Black mates";
  if (score === null) return "";
  const abs = Math.abs(score);
  if (abs < 25) return "Equal";
  const side = score > 0 ? "White" : "Black";
  if (abs < 100) return `${side} edge`;
  if (abs < 300) return `${side} better`;
  return `${side} winning`;
}

/** The number shown next to a line: "+0.35", "−1.20", "M3", "−M3". */
export function formatEvalValue(score: number | null, mate: number | null): string {
  if (mate !== null) return mate > 0 ? `M${mate}` : `−M${Math.abs(mate)}`;
  if (score === null) return "—";
  const pawns = (Math.abs(score) / 100).toFixed(2);
  if (score > 0) return `+${pawns}`;
  if (score < 0) return `−${pawns}`;
  return "0.00";
}

/** How much of the eval bar White owns, 0–100. A logistic curve keeps ±3 pawns visibly decisive. */
export function whiteShare(score: number | null, mate: number | null): number {
  if (mate !== null) return mate > 0 ? 97 : 3;
  if (score === null) return 50;
  return 50 + 50 * Math.tanh(score / 400);
}
