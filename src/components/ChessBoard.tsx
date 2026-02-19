import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import type {
  Square,
  Arrow,
  CustomSquareStyles,
  Piece,
  PromotionPieceOption,
} from "react-chessboard/dist/chessboard/types";

interface ChessBoardProps {
  position: string;
  onMove: (from: string, to: string, promotion?: string) => boolean;
  lastMove: { from: string; to: string } | null;
  inCheck: boolean;
  kingInCheckSquare: string | null;
  engineArrow: Arrow | null;
}

const ChessBoard: React.FC<ChessBoardProps> = ({
  position,
  onMove,
  lastMove,
  inCheck,
  kingInCheckSquare,
  engineArrow,
}) => {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoveSquares, setLegalMoveSquares] = useState<string[]>([]);
  const [userArrows, setUserArrows] = useState<Arrow[]>([]);
  const [promotionPending, setPromotionPending] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  // Clear selection and pending promotion when position changes
  useEffect(() => {
    setSelectedSquare(null);
    setLegalMoveSquares([]);
    setPromotionPending(null);
  }, [position]);

  const customSquareStyles = useMemo((): CustomSquareStyles => {
    const chess = new Chess(position);
    const styles: Partial<Record<Square, Record<string, string | number>>> = {};

    // 1. Last move highlight (amber) — lowest priority
    if (lastMove) {
      styles[lastMove.from as Square] = {
        backgroundColor: "rgba(255, 170, 0, 0.4)",
      };
      styles[lastMove.to as Square] = {
        backgroundColor: "rgba(255, 170, 0, 0.4)",
      };
    }

    // 2. Selected square (blue)
    if (selectedSquare) {
      styles[selectedSquare] = { backgroundColor: "rgba(20, 85, 255, 0.5)" };
    }

    // 3. Legal move squares (dot for empty, ring for capture)
    for (const sq of legalMoveSquares) {
      const occupied = chess.get(sq as Square);
      if (occupied) {
        styles[sq as Square] = {
          ...styles[sq as Square],
          background:
            "radial-gradient(circle, transparent 55%, rgba(20, 85, 30, 0.65) 55%)",
        };
      } else {
        styles[sq as Square] = {
          ...styles[sq as Square],
          background:
            "radial-gradient(circle, rgba(20, 85, 30, 0.65) 26%, transparent 26%)",
        };
      }
    }

    // 4. Check highlight (red) — highest priority, fully replaces prior styles
    if (inCheck && kingInCheckSquare) {
      styles[kingInCheckSquare as Square] = {
        background: "rgba(220, 30, 30, 0.7)",
      };
    }

    return styles;
  }, [position, lastMove, selectedSquare, legalMoveSquares, inCheck, kingInCheckSquare]);

  const mergedArrows = useMemo((): Arrow[] => {
    const arrows: Arrow[] = [...userArrows];
    if (engineArrow) {
      const dup = userArrows.some(
        (a) => a[0] === engineArrow[0] && a[1] === engineArrow[1]
      );
      if (!dup) arrows.push(engineArrow);
    }
    return arrows;
  }, [userArrows, engineArrow]);

  // Select a square and compute its legal move targets. Returns true if selection succeeded.
  const selectSquare = useCallback(
    (square: Square): boolean => {
      const chess = new Chess(position);
      const piece = chess.get(square);
      const turn = chess.turn();
      if (!piece || piece.color !== turn) {
        setSelectedSquare(null);
        setLegalMoveSquares([]);
        return false;
      }
      const moves = chess.moves({ square, verbose: true });
      setSelectedSquare(square);
      setLegalMoveSquares(moves.map((m) => m.to));
      return true;
    },
    [position]
  );

  const handleSquareClick = useCallback(
    (square: Square) => {
      const chess = new Chess(position);

      if (!selectedSquare) {
        selectSquare(square);
        return;
      }

      // A square is already selected
      if (legalMoveSquares.includes(square)) {
        // Legal move target — check for promotion
        const piece = chess.get(selectedSquare);
        const isPromotion =
          piece?.type === "p" &&
          ((piece.color === "w" && square[1] === "8") ||
            (piece.color === "b" && square[1] === "1"));

        if (isPromotion) {
          setPromotionPending({ from: selectedSquare, to: square });
        } else {
          onMove(selectedSquare, square);
        }
        setSelectedSquare(null);
        setLegalMoveSquares([]);
        return;
      }

      // Not a legal target — re-select if own piece, otherwise deselect
      const clickedPiece = chess.get(square);
      if (clickedPiece && clickedPiece.color === chess.turn()) {
        selectSquare(square);
        return;
      }

      setSelectedSquare(null);
      setLegalMoveSquares([]);
    },
    [position, selectedSquare, legalMoveSquares, onMove, selectSquare]
  );

  const handlePieceDrop = useCallback(
    (sourceSquare: Square, targetSquare: Square): boolean => {
      return onMove(sourceSquare, targetSquare);
    },
    [onMove]
  );

  const handlePieceDragBegin = useCallback(
    (_piece: Piece, square: Square) => {
      selectSquare(square);
    },
    [selectSquare]
  );

  const handlePieceDragEnd = useCallback(() => {
    setSelectedSquare(null);
    setLegalMoveSquares([]);
  }, []);

  const handlePromotionPieceSelect = useCallback(
    (
      piece?: PromotionPieceOption,
      fromSquare?: Square,
      toSquare?: Square
    ): boolean => {
      if (!piece) return false;
      const promotionChar = piece[1].toLowerCase(); // "wQ" → "q"
      const from = promotionPending?.from ?? fromSquare;
      const to = promotionPending?.to ?? toSquare;
      if (!from || !to) return false;
      const success = onMove(from, to, promotionChar);
      setPromotionPending(null);
      return success;
    },
    [promotionPending, onMove]
  );

  return (
    <div className="rounded-lg shadow-lg p-2 bg-zinc-800 w-full max-w-[580px]">
      <Chessboard
        position={position}
        animationDuration={200}
        areArrowsAllowed={true}
        customArrows={mergedArrows}
        onArrowsChange={setUserArrows}
        customSquareStyles={customSquareStyles}
        onSquareClick={handleSquareClick}
        onPieceDrop={handlePieceDrop}
        onPieceDragBegin={handlePieceDragBegin}
        onPieceDragEnd={handlePieceDragEnd}
        showPromotionDialog={promotionPending !== null}
        promotionToSquare={promotionPending?.to ?? null}
        promotionDialogVariant="modal"
        onPromotionPieceSelect={handlePromotionPieceSelect}
      />
    </div>
  );
};

export default ChessBoard;
