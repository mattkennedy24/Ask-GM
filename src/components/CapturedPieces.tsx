import React, { useMemo } from "react";
import { Chess } from "chess.js";

// Piece values for material advantage calculation
const PIECE_VALUES: Record<string, number> = {
  p: 1, n: 3, b: 3, r: 5, q: 9, k: 0,
};

// Unicode chess symbols — always use filled/solid variants for both colors;
// CSS color + stroke distinguishes white vs black pieces on a dark background.
const PIECE_SYMBOLS: Record<string, string> = {
  q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

// Starting piece counts per color
const STARTING: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const PIECE_ORDER = ["q", "r", "b", "n", "p"] as const;

function computeCaptured(fen: string) {
  const chess = new Chess(fen);
  const onBoard: Record<string, Record<string, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  };

  for (const row of chess.board()) {
    for (const piece of row) {
      if (piece && piece.type !== "k") {
        onBoard[piece.color][piece.type]++;
      }
    }
  }

  // Pieces captured BY white = missing black pieces
  const capturedByWhite: string[] = [];
  // Pieces captured BY black = missing white pieces
  const capturedByBlack: string[] = [];
  let materialAdvantage = 0;

  for (const type of PIECE_ORDER) {
    const missingBlack = STARTING[type] - onBoard.b[type];
    const missingWhite = STARTING[type] - onBoard.w[type];
    for (let i = 0; i < missingBlack; i++) capturedByWhite.push(type);
    for (let i = 0; i < missingWhite; i++) capturedByBlack.push(type);
    materialAdvantage += (missingBlack - missingWhite) * PIECE_VALUES[type];
  }

  return { capturedByWhite, capturedByBlack, materialAdvantage };
}

interface CapturedPiecesProps {
  fen: string;
  /** "top" = shown above board (black's captures of white pieces; from black's side) */
  side: "top" | "bottom";
}

const CapturedPieces: React.FC<CapturedPiecesProps> = ({ fen, side }) => {
  const { capturedByWhite, capturedByBlack, materialAdvantage } = useMemo(
    () => computeCaptured(fen),
    [fen]
  );

  // "top" row shows captures made by Black (white pieces taken)
  // "bottom" row shows captures made by White (black pieces taken)
  const pieces = side === "top" ? capturedByBlack : capturedByWhite;

  // Material advantage sign: positive = white ahead, negative = black ahead
  const showAdvantage =
    side === "bottom" && materialAdvantage > 0
      ? `+${materialAdvantage}`
      : side === "top" && materialAdvantage < 0
      ? `+${Math.abs(materialAdvantage)}`
      : null;

  // White pieces: cream fill with dark shadow for definition
  // Black pieces: near-black fill with light outline so they're visible on dark bg
  const pieceStyle: React.CSSProperties =
    side === "top"
      ? { color: "#f0d9b5", textShadow: "0 0 2px #000, 0 0 4px #000" }
      : { color: "#1a1a1a", WebkitTextStroke: "0.8px #aaa" };

  return (
    <div className="flex items-center gap-1.5 min-h-[20px] px-1">
      <span className="text-base leading-none tracking-tighter">
        {pieces.map((type, i) => (
          <span key={i} style={pieceStyle}>
            {PIECE_SYMBOLS[type]}
          </span>
        ))}
      </span>
      {showAdvantage && (
        <span
          className="text-xs font-semibold tabular-nums"
          style={{ color: "var(--c-gold)", fontFamily: "var(--f-mono)" }}
        >
          {showAdvantage}
        </span>
      )}
    </div>
  );
};

export default CapturedPieces;
