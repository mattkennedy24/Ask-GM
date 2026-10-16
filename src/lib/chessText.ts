import { Chess, type Move } from "chess.js";
import { type ResolvedMove, resolveAgainst } from "./chessMoves";

/**
 * Split a grandmaster's reply into plain text and chess moves, so moves can be
 * highlighted and — when they are legal in the position the reply was written
 * for — played with a click.
 */
export type ChessTextSegment =
  | { kind: "text"; text: string }
  | {
      kind: "move";
      /** The move exactly as written, including any check symbol ("Qh5+"). */
      text: string;
      /** The legal move it denotes in the reply's position, or null if it is not playable there. */
      move: ResolvedMove | null;
    };

// Castling, piece moves, pawn captures, and bare squares ("e4"). The check/mate suffix is part of the match.
const TOKEN =
  /(?<![A-Za-z0-9])(?:O-O-O|O-O|[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|[a-h]x[a-h][1-8](?:=[QRBN])?|[a-h][1-8](?:=[QRBN])?)(?![A-Za-z0-9])[+#]?/g;

const BARE_SQUARE = /^[a-h][1-8]$/;

// A bare square is a pawn push ("play e4") only when it is not obviously naming a square
// ("pressure on e5", "the d5 square", "e4 pawn").
const SQUARE_CONTEXT_BEFORE = /\b(?:on|to|at|from|of|via|toward|towards|onto|into|the|that|this|your|their|his|her|its|my|our|a|an)\s+$/i;
const SQUARE_CONTEXT_AFTER = /^\s+(?:pawn|square|file|rank|diagonal|outpost)\b/i;

/**
 * @param text the reply
 * @param fen the position the reply was written for; when omitted, moves are highlighted but never playable
 */
export function tokenizeChessText(text: string, fen?: string): ChessTextSegment[] {
  let legal: Move[] | null = null;
  let pawnPushes = new Set<string>();
  if (fen) {
    try {
      legal = new Chess(fen).moves({ verbose: true });
      pawnPushes = new Set(legal.filter((m) => m.piece === "p" && !m.captured).map((m) => m.san.replace(/[+#]$/, "")));
    } catch {
      legal = null;
    }
  }

  const segments: ChessTextSegment[] = [];
  let cursor = 0;
  const pushText = (end: number) => {
    if (end > cursor) segments.push({ kind: "text", text: text.slice(cursor, end) });
  };

  for (const match of text.matchAll(TOKEN)) {
    const token = match[0];
    const start = match.index ?? 0;
    const bare = token.replace(/[+#]$/, "");

    if (BARE_SQUARE.test(bare)) {
      // Plain squares only count as moves when they are a legal pawn push here and read like one.
      const isPush = pawnPushes.has(bare);
      const before = text.slice(Math.max(0, start - 14), start);
      const after = text.slice(start + token.length, start + token.length + 12);
      if (!isPush || SQUARE_CONTEXT_BEFORE.test(before) || SQUARE_CONTEXT_AFTER.test(after)) continue;
    }

    pushText(start);
    segments.push({
      kind: "move",
      text: token,
      move: legal ? resolveAgainst(legal, token) : null,
    });
    cursor = start + token.length;
  }
  pushText(text.length);
  return segments;
}
