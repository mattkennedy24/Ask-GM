/**
 * Rough question type, used only to tell the model how long its answer should be.
 * A wrong guess costs a sentence of length, never correctness.
 */

const TACTICAL =
  /\b(best move|what should i play|what to play|what('?s| is) the move|which move|next move|blunder|tactic|checkmate|mate in|combination|fork|pin|skewer|sacrifice|trap|threat)\b/;

const THEORY =
  /\b(opening|theory|variation|line|gambit|defen[cs]e|sicilian|french|caro[- ]?kann|slav|indian|ruy|lopez|london|catalan|nimzo|gr[uü]nfeld|italian|scotch|petroff|pirc|dutch|english|r[eé]ti|najdorf|dragon|evans|fried liver|berlin|marshall|scandinavian|queen'?s gambit|king'?s gambit)\b/;

/** @returns {"tactical" | "theory" | "conceptual"} */
export function classifyQuestion(question) {
  const q = String(question ?? "").toLowerCase();
  if (TACTICAL.test(q)) return "tactical";
  if (THEORY.test(q)) return "theory";
  return "conceptual";
}

const LENGTH_HINTS = {
  tactical: "1-2 punchy sentences — it is a direct move question",
  theory: "4-5 sentences — opening ideas deserve a little context",
  conceptual: "3-4 sentences — a strategic or conceptual question",
};

export function lengthHintFor(question) {
  return LENGTH_HINTS[classifyQuestion(question)];
}
