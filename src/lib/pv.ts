import { Chess } from "chess.js";

export interface PvToken {
  kind: "number" | "move";
  /** "12." or "12…" for numbers, SAN for moves. */
  text: string;
  /** For moves: index of the move within the line (0 = the first move). */
  moveIndex: number;
}

/**
 * A principal variation (UCI moves) as numbered SAN tokens, ready to render:
 * `1. e4 e5 2. Nf3`, or `12… Nf6 13. Bg5` when Black is to move.
 * Stops at the first move that is not legal.
 */
export function pvTokens(fen: string, pv: readonly string[], maxMoves = 8): PvToken[] {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return [];
  }

  const tokens: PvToken[] = [];
  for (let i = 0; i < Math.min(pv.length, maxMoves); i++) {
    const number = chess.moveNumber();
    const whiteToMove = chess.turn() === "w";

    let move;
    try {
      move = chess.move({ from: pv[i].slice(0, 2), to: pv[i].slice(2, 4), promotion: pv[i][4] });
    } catch {
      break;
    }

    if (whiteToMove) tokens.push({ kind: "number", text: `${number}.`, moveIndex: -1 });
    else if (i === 0) tokens.push({ kind: "number", text: `${number}…`, moveIndex: -1 });
    tokens.push({ kind: "move", text: move.san, moveIndex: i });
  }
  return tokens;
}
