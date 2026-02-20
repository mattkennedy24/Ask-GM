import React, { useMemo } from "react";
import { Chess } from "chess.js";

// Piece values for material advantage calculation
const PIECE_VALUES: Record<string, number> = {
  p: 1, n: 3, b: 3, r: 5, q: 9, k: 0,
};

// Unicode chess symbols
const WHITE_SYMBOLS: Record<string, string> = {
  q: "♕", r: "♖", b: "♗", n: "♘", p: "♙",
};
const BLACK_SYMBOLS: Record<string, string> = {
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
  const symbols = side === "top" ? WHITE_SYMBOLS : BLACK_SYMBOLS;

  // Material advantage sign: positive = white ahead, negative = black ahead
  const showAdvantage =
    side === "bottom" && materialAdvantage > 0
      ? `+${materialAdvantage}`
      : side === "top" && materialAdvantage < 0
      ? `+${Math.abs(materialAdvantage)}`
      : null;

  return (
    <div className="flex items-center gap-1 min-h-[22px] px-1">
      <span className="text-lg leading-none tracking-tight">
        {pieces.map((type, i) => (
          <span key={i} className={side === "top" ? "text-zinc-200" : "text-zinc-300"}>
            {symbols[type]}
          </span>
        ))}
      </span>
      {showAdvantage && (
        <span className="text-xs font-bold text-zinc-400 ml-1">{showAdvantage}</span>
      )}
    </div>
  );
};

export default CapturedPieces;
