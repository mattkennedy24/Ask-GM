import { Chess } from "chess.js";

/**
 * "How good was the move that was just played?"
 *
 * The browser's Stockfish measures how much evaluation the last move gave up and sends
 * only a verdict (a fixed set of words), a number and the engine's preferred move in UCI.
 * Nothing the browser sends is printed as text: this module replays the move list itself,
 * checks that it really leads to the position being discussed, converts the engine's
 * preferred move to SAN in the position *before* the move, and only then writes a sentence.
 * A review that does not check out is dropped rather than trusted.
 */

export const REVIEW_QUALITIES = Object.freeze(["best", "good", "inaccuracy", "mistake", "blunder"]);

const samePosition = (a, b) => a.split(" ").slice(0, 2).join(" ") === b.split(" ").slice(0, 2).join(" ");

const AN_QUALITY = new Set(["inaccuracy"]);

function moveLabel(plyNumber, san) {
  const number = Math.ceil(plyNumber / 2);
  return `${number}${plyNumber % 2 === 1 ? "." : "..."}${san}`;
}

/**
 * @param {{ fen: string, moveHistory: string[], review: { quality: string, lossCp: number, bestMove: string | null } | null }} input
 * @returns {string | null} one sentence for the prompt, or null when there is nothing trustworthy to say
 */
export function describeMoveReview({ fen, moveHistory, review }) {
  if (!review || !REVIEW_QUALITIES.includes(review.quality) || moveHistory.length === 0) return null;

  const chess = new Chess();
  let before = chess.fen();
  let played;
  try {
    moveHistory.forEach((san, index) => {
      if (index === moveHistory.length - 1) before = chess.fen();
      played = chess.move(san);
    });
  } catch {
    return null;
  }
  if (!played || !samePosition(chess.fen(), fen)) return null;

  const plyNumber = moveHistory.length;
  const side = played.color === "w" ? "White" : "Black";
  const label = moveLabel(plyNumber, played.san);

  let preferred = null;
  if (review.bestMove) {
    try {
      const probe = new Chess(before);
      const move = probe.move({ from: review.bestMove.slice(0, 2), to: review.bestMove.slice(2, 4), promotion: review.bestMove[4] });
      if (move.san !== played.san) preferred = moveLabel(plyNumber, move.san);
    } catch {
      preferred = null; // the engine move does not exist in that position: ignore it
    }
  }

  if (review.quality === "best") return `${side}'s last move, ${label}, was the engine's top choice.`;
  if (review.quality === "good") {
    return `${side}'s last move, ${label}, was sound: close to the engine's best.${preferred ? ` The engine slightly preferred ${preferred}.` : ""}`;
  }

  const pawns = review.lossCp >= 1000 ? "10 or more" : (review.lossCp / 100).toFixed(1);
  const article = AN_QUALITY.has(review.quality) ? "an" : "a";
  return (
    `${side}'s last move, ${label}, was ${article} ${review.quality}: it gave up about ${pawns} pawns of evaluation.` +
    (preferred ? ` The engine preferred ${preferred}.` : "")
  );
}
