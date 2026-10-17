#!/usr/bin/env node
/**
 * How right are the "what can be won by capture" facts the coach is given?
 *
 * Plays thousands of random games to random depths, and for every position compares the claims made by
 * server/lib/tactics.js (a static exchange evaluation) with an independent brute-force search that plays
 * out every capture on the square with real legal moves. It reports claims the search refutes, and winnable
 * pieces the facts overlooked. A change to tactics.js should not make either number worse.
 *
 *   npm run verify:tactics            (a few minutes)
 *   POSITIONS=500 npm run verify:tactics
 */
import { Chess } from "chess.js";
import { getPieceSafety } from "../server/lib/tactics.js";

const POSITIONS = Number(process.env.POSITIONS ?? 3000);
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

let seed = 20240607;
const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

function bestExchange(chess, square, depth = 0) {
  if (depth > 12 || chess.attackers(square, chess.turn()).length === 0) return 0;
  let best = 0;
  for (const move of chess.moves({ verbose: true })) {
    if (move.to !== square || !move.captured || move.flags.includes("e")) continue;
    chess.move(move);
    best = Math.max(best, VALUE[move.captured] - bestExchange(chess, square, depth + 1));
    chess.undo();
  }
  return best;
}

let positions = 0;
let claims = 0;
let wrong = 0;
let findable = 0;
let missed = 0;
const examples = [];

for (let n = 0; n < POSITIONS; n++) {
  const chess = new Chess();
  const plies = 8 + Math.floor(random() * 60);
  for (let i = 0; i < plies; i++) {
    const moves = chess.moves();
    if (moves.length === 0) break;
    chess.move(moves[Math.floor(random() * moves.length)]);
  }
  if (chess.isGameOver()) continue;
  positions++;

  const truth = new Set();
  for (const row of chess.board()) {
    for (const piece of row) {
      if (piece && piece.color !== chess.turn() && piece.type !== "k" && bestExchange(chess, piece.square) > 0) truth.add(piece.square);
    }
  }

  const { opportunities } = getPieceSafety(chess.fen());
  const claimed = new Set(opportunities.map((text) => /on ([a-h][1-8])/.exec(text)[1]));
  for (const square of claimed) {
    claims++;
    if (!truth.has(square)) {
      wrong++;
      if (examples.length < 5) examples.push(`${chess.fen()}  claims ${square}`);
    }
  }
  if (opportunities.length < 4) {
    for (const square of truth) {
      findable++;
      if (!claimed.has(square)) missed++;
    }
  }
}

const percent = (part, whole) => `${((100 * part) / Math.max(1, whole)).toFixed(2)}%`;
console.log(`${positions} positions`);
console.log(`claims refuted by search: ${wrong} of ${claims} (${percent(wrong, claims)})`);
console.log(`winnable pieces not listed: ${missed} of ${findable} (${percent(missed, findable)})`);
for (const example of examples) console.log(`  e.g. ${example}`);
process.exit(wrong / Math.max(1, claims) > 0.005 || missed / Math.max(1, findable) > 0.01 ? 1 : 0);
