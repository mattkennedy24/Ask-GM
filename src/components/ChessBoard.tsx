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
  animationDuration?: number;
}

const ChessBoard: React.FC<ChessBoardProps> = ({
  position,
  onMove,
  lastMove,
  inCheck,
  kingInCheckSquare,
  engineArrow,
  animationDuration = 200,
}) => {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoveSquares, setLegalMoveSquares] = useState<string[]>([]);
  const [userArrows, setUserArrows] = useState<Arrow[]>([]);
  const [promotionPending, setPromotionPending] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  useEffect(() => {
    setSelectedSquare(null);
    setLegalMoveSquares([]);
    setPromotionPending(null);
  }, [position]);

  const customSquareStyles = useMemo((): CustomSquareStyles => {
    const chess = new Chess(position);
    const styles: Partial<Record<Square, Record<string, string | number>>> = {};

    if (lastMove) {
      styles[lastMove.from as Square] = { backgroundColor: "rgba(205, 165, 0, 0.35)" };
      styles[lastMove.to as Square]   = { backgroundColor: "rgba(205, 165, 0, 0.35)" };
    }

    if (selectedSquare) {
      styles[selectedSquare] = { backgroundColor: "rgba(70, 116, 232, 0.45)" };
    }

    for (const sq of legalMoveSquares) {
      const occupied = chess.get(sq as Square);
      if (occupied) {
        styles[sq as Square] = {
          ...styles[sq as Square],
          background: "radial-gradient(circle, transparent 55%, rgba(56, 200, 122, 0.55) 55%)",
        };
      } else {
        styles[sq as Square] = {
          ...styles[sq as Square],
          background: "radial-gradient(circle, rgba(56, 200, 122, 0.55) 26%, transparent 26%)",
        };
      }
    }

    if (inCheck && kingInCheckSquare) {
      styles[kingInCheckSquare as Square] = {
        background: "radial-gradient(circle, rgba(220, 40, 40, 0.85) 0%, rgba(220, 40, 40, 0.4) 70%, transparent 100%)",
      };
    }

    return styles;
  }, [position, lastMove, selectedSquare, legalMoveSquares, inCheck, kingInCheckSquare]);

  const mergedArrows = useMemo((): Arrow[] => {
    const arrows: Arrow[] = [...userArrows];
    if (engineArrow) {
      const dup = userArrows.some((a) => a[0] === engineArrow[0] && a[1] === engineArrow[1]);
      if (!dup) arrows.push(engineArrow);
    }
    return arrows;
  }, [userArrows, engineArrow]);

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

      if (legalMoveSquares.includes(square)) {
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
    (sourceSquare: Square, targetSquare: Square): boolean => onMove(sourceSquare, targetSquare),
    [onMove]
  );

  const handlePieceDragBegin = useCallback(
    (_piece: Piece, square: Square) => { selectSquare(square); },
    [selectSquare]
  );

  const handlePieceDragEnd = useCallback(() => {
    setSelectedSquare(null);
    setLegalMoveSquares([]);
  }, []);

  const handlePromotionPieceSelect = useCallback(
    (piece?: PromotionPieceOption, fromSquare?: Square, toSquare?: Square): boolean => {
      if (!piece) return false;
      const promotionChar = piece[1].toLowerCase();
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
    <div
      className="w-full rounded-lg overflow-hidden"
      style={{
        background: "var(--c-raised)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)",
      }}
    >
      <Chessboard
        position={position}
        animationDuration={animationDuration}
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
        customDarkSquareStyle={{ backgroundColor: "#A0785A" }}
        customLightSquareStyle={{ backgroundColor: "#EDE0C8" }}
      />
    </div>
  );
};

export default ChessBoard;
