import { Chess } from "chess.js";

/**
 * Catch moves the model invents.
 *
 * A mention only counts as "illegal" when it is playable nowhere the analysis
 * can reach: the current position, any position along the engine lines shown to
 * the model, a move already played in the game, or an alternative at one of the
 * last few positions of the game. That keeps quoted variations
 * ("1. e4 e5 2. Nf3") and references to past moves from being flagged, which a
 * naive "is it legal right now?" check would do on almost every answer.
 */

// Piece moves, castling and pawn captures. Bare squares such as "e4" are NOT matched:
// in prose ("pressure on e5") they are indistinguishable from square names.
// Check/mate suffixes are intentionally outside the capture group.
const MOVE_TOKEN =
  /(?<![A-Za-z0-9])(O-O-O|O-O|[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|[a-h]x[a-h][1-8](?:=[QRBN])?)(?![A-Za-z0-9])/g;

const MOVE_PARTS = /^([KQRBN])?([a-h])?([1-8])?(x)?([a-h][1-8])(?:=([QRBN]))?$/;

/**
 * Canonical key for a SAN move. Disambiguation, capture marker and check symbols
 * are ignored for piece moves, so "Nd2", "Nbd2" and "Nxd2" all compare as the same
 * destination — we only care that the move exists, not that SAN is perfectly typeset.
 */
export function moveKey(san) {
  const s = san.replace(/[+#!?]+$/, "");
  if (s === "O-O" || s === "O-O-O") return s;

  const parts = MOVE_PARTS.exec(s);
  if (!parts) return s;
  const [, piece, fromFile, , capture, destination, promotion] = parts;

  if (piece) return `${piece}${destination}`;
  const suffix = promotion ? `=${promotion}` : "";
  return capture ? `${fromFile}x${destination}${suffix}` : `${destination}${suffix}`;
}

function addLegalMoveKeys(chess, keys) {
  for (const san of chess.moves()) keys.add(moveKey(san));
}

// How many positions back from the current one a reply may talk about ("instead of 9.Bd3 you
// should have played 9.Be2"). Beyond that, a move that is legal nowhere near the present
// position is far more likely to be an invention than a retrospective.
const RECENT_PLIES = 8;

const samePosition = (a, b) => a.split(" ").slice(0, 2).join(" ") === b.split(" ").slice(0, 2).join(" ");

/** Legal moves from the last few positions of the game, if the move list really leads to `fen`. */
function addRecentPastMoveKeys(fen, moveHistory, keys) {
  const chess = new Chess();
  const positions = [];
  try {
    for (const san of moveHistory) {
      positions.push(chess.fen());
      chess.move(san);
    }
  } catch {
    return; // the list is not a legal game from the start: it says nothing reliable about the past
  }
  if (!samePosition(chess.fen(), fen)) return;
  for (const before of positions.slice(-RECENT_PLIES)) addLegalMoveKeys(new Chess(before), keys);
}

/** Every move key that may legitimately be mentioned for this position and analysis. */
export function collectAllowedMoveKeys({ fen, topLines = [], moveHistory = [], extraKeys = [] }) {
  const keys = new Set();

  let root;
  try {
    root = new Chess(fen);
  } catch {
    return keys;
  }
  addLegalMoveKeys(root, keys);

  for (const line of topLines) {
    const chess = new Chess(fen);
    for (const uci of line.pv ?? []) {
      try {
        chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      } catch {
        break;
      }
      addLegalMoveKeys(chess, keys);
    }
  }

  for (const san of moveHistory) keys.add(moveKey(san));
  for (const key of extraKeys) keys.add(key);
  addRecentPastMoveKeys(fen, moveHistory, keys);
  return keys;
}

/** Move tokens in `text` that are not in `allowedKeys` (deduplicated, original spelling). */
export function findIllegalMoveMentions(text, allowedKeys) {
  if (allowedKeys.size === 0) return [];
  const flagged = new Set();
  for (const [, token] of text.matchAll(MOVE_TOKEN)) {
    if (!allowedKeys.has(moveKey(token))) flagged.add(token);
  }
  return [...flagged];
}
