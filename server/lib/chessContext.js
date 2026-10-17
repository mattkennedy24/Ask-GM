import { Chess } from "chess.js";

/**
 * Plain-language facts about a position, used to ground the grandmaster's answer.
 * Everything here is derived from the FEN with chess.js — nothing is guessed.
 */

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

function describeCentipawns(cp) {
  const abs = Math.abs(cp);
  const side = cp >= 0 ? "White" : "Black";
  if (abs < 25) return "equal";
  if (abs < 100) return `${side} slightly better`;
  if (abs < 300) return `${side} clearly better`;
  return `${side} winning`;
}

/** Engine score from White's point of view → a phrase such as "+0.35 (White slightly better)". */
export function formatEval(score, mate) {
  if (mate !== null && mate !== undefined) {
    return `${mate > 0 ? "White" : "Black"} mates in ${Math.abs(mate)}`;
  }
  if (score === null || score === undefined) return "no evaluation";
  const pawns = score / 100;
  return `${pawns > 0 ? "+" : ""}${pawns.toFixed(2)} (${describeCentipawns(score)})`;
}

/**
 * Convert a UCI principal variation to numbered SAN, e.g. "1. e4 e5 2. Nf3".
 * Stops at the first move that is not legal, so the output is always a real line.
 */
export function formatPvLine(fen, pvMoves, maxMoves = 7) {
  let chess;
  try {
    chess = new Chess(fen);
  } catch {
    return "";
  }

  const parts = [];
  for (let i = 0; i < Math.min(pvMoves.length, maxMoves); i++) {
    const uci = pvMoves[i];
    const moveNumber = chess.moveNumber();
    const whiteToMove = chess.turn() === "w";

    let move;
    try {
      move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    } catch {
      break;
    }

    if (whiteToMove) parts.push(`${moveNumber}.`);
    else if (i === 0) parts.push(`${moveNumber}...`);
    parts.push(move.san);
  }
  return parts.join(" ");
}

function materialTotals(chess) {
  const totals = { w: 0, b: 0 };
  for (const row of chess.board()) {
    for (const piece of row) {
      if (piece && piece.type !== "k") totals[piece.color] += PIECE_VALUES[piece.type];
    }
  }
  return totals;
}

export function getMaterialBalance(fen) {
  try {
    const { w, b } = materialTotals(new Chess(fen));
    const diff = w - b;
    if (diff === 0) return `Material is equal (${w} points each).`;
    const side = diff > 0 ? "White" : "Black";
    return `${side} is ahead by ${Math.abs(diff)} point${Math.abs(diff) === 1 ? "" : "s"} of material (White ${w}, Black ${b}).`;
  } catch {
    return "Material balance unknown.";
  }
}

/** opening / middlegame / endgame, judged from the non-pawn material left on the board. */
export function getGamePhase(fen) {
  try {
    const chess = new Chess(fen);
    let majorMinor = 0;
    let queens = 0;
    for (const row of chess.board()) {
      for (const piece of row) {
        if (!piece || piece.type === "k" || piece.type === "p") continue;
        majorMinor += PIECE_VALUES[piece.type];
        if (piece.type === "q") queens++;
      }
    }
    // 62 points of non-pawn material each side at the start is 2 * (9 + 10 + 6 + 6) = 62.
    if (majorMinor <= 26 || (queens === 0 && majorMinor <= 32)) return "endgame";
    if (chess.moveNumber() <= 10 && majorMinor >= 56) return "opening";
    return "middlegame";
  } catch {
    return "unknown";
  }
}

/** Which files are fully open or half-open — what a rook cares about. */
export function getFileStatus(fen) {
  try {
    const chess = new Chess(fen);
    const open = [];
    const whiteHalf = [];
    const blackHalf = [];

    for (const file of FILES) {
      let white = false;
      let black = false;
      for (let rank = 1; rank <= 8; rank++) {
        const piece = chess.get(`${file}${rank}`);
        if (piece?.type !== "p") continue;
        if (piece.color === "w") white = true;
        else black = true;
      }
      if (!white && !black) open.push(file);
      else if (!white) whiteHalf.push(file);
      else if (!black) blackHalf.push(file);
    }

    const notes = [];
    if (open.length) notes.push(`open files: ${open.join(", ")}`);
    if (whiteHalf.length) notes.push(`half-open for White: ${whiteHalf.join(", ")}`);
    if (blackHalf.length) notes.push(`half-open for Black: ${blackHalf.join(", ")}`);
    return notes.length ? notes.join("; ") : "no open or half-open files (closed structure)";
  } catch {
    return "";
  }
}

function describeCastling(canKingside, canQueenside) {
  if (canKingside && canQueenside) return "can castle either side";
  if (canKingside) return "can still castle kingside";
  if (canQueenside) return "can still castle queenside";
  return "can no longer castle";
}

const HOME_RANK = { w: 1, b: 8 };

/**
 * Where each king stands, and whether castling is still available.
 *
 * What a king's square means depends on the phase: a king walking to e4 is a
 * liability with queens on the board and an asset in a king-and-pawn ending, so
 * the wording changes with `getGamePhase`.
 */
export function getKingSafety(fen) {
  try {
    const chess = new Chess(fen);
    const rights = fen.split(" ")[2] ?? "-";
    const endgame = getGamePhase(fen) === "endgame";
    const notes = [];

    for (const [color, label, kingside, queenside] of [
      ["w", "White", "K", "Q"],
      ["b", "Black", "k", "q"],
    ]) {
      const [square] = chess.findPiece({ type: "k", color });
      if (!square) continue;
      const file = square[0];
      const rank = Number(square[1]);
      const stepsFromHome = Math.abs(rank - HOME_RANK[color]);
      const canCastle = rights.includes(kingside) || rights.includes(queenside);

      if (endgame) {
        const centralized = "cdef".includes(file) && rank >= 3 && rank <= 6;
        notes.push(centralized ? `${label}'s king is active in the center (${square}).` : `${label}'s king is on ${square}.`);
      } else if (stepsFromHome >= 2) {
        notes.push(
          "cdef".includes(file)
            ? `${label}'s king is exposed in the center (${square}).`
            : `${label}'s king has walked out to ${square} and is exposed.`,
        );
      } else if (stepsFromHome === 1) {
        notes.push(
          canCastle
            ? `${label}'s king has stepped off its back rank (${square}).`
            : `${label}'s king has stepped off its back rank (${square}) and can no longer castle.`,
        );
      } else if (file === "g" || file === "h") {
        notes.push(`${label}'s king is tucked away on the kingside.`);
      } else if ("abc".includes(file)) {
        notes.push(`${label}'s king is on the queenside.`);
      } else if (!canCastle) {
        notes.push(`${label}'s king is stuck in the center and can no longer castle.`);
      }
    }

    // In a bare ending with no rights left there is nothing to say about castling.
    if (!endgame || /[KQkq]/.test(rights)) {
      notes.push(
        `Castling: White ${describeCastling(rights.includes("K"), rights.includes("Q"))}; Black ${describeCastling(rights.includes("k"), rights.includes("q"))}.`,
      );
    }
    return notes.join(" ");
  } catch {
    return "";
  }
}

/** How a finished game ended, or null while it is still going. Repetition cannot be told from one position. */
export function describeGameResult(fen) {
  try {
    const chess = new Chess(fen);
    if (chess.isCheckmate()) return `Checkmate: ${chess.turn() === "w" ? "Black" : "White"} has won.`;
    if (chess.isStalemate()) return "Stalemate: the side to move has no legal move and is not in check, so the game is drawn.";
    if (chess.isInsufficientMaterial()) return "Draw by insufficient material: neither side can deliver checkmate.";
    if (chess.isDrawByFiftyMoves()) return "Draw by the fifty-move rule.";
    return null;
  } catch {
    return null;
  }
}
