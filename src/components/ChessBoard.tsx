import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { Arrow, CustomSquareStyles, Piece, PromotionPieceOption, Square } from "react-chessboard/dist/chessboard/types";

interface ChessBoardProps {
  position: string;
  /** Called with a move the user made; return false to snap the piece back. */
  onMove: (from: string, to: string, promotion?: string) => boolean;
  /** When false the board only displays (opening lessons, engine previews). */
  interactive: boolean;
  lastMove: { from: string; to: string } | null;
  kingInCheckSquare: string | null;
  engineArrow: Arrow | null;
  orientation: "white" | "black";
  animationDuration?: number;
}

const LAST_MOVE = "rgba(205, 165, 0, 0.35)";
const SELECTED = "rgba(91, 138, 240, 0.45)";
const LEGAL_DOT = "radial-gradient(circle, rgba(63, 200, 122, 0.55) 26%, transparent 26%)";
const LEGAL_CAPTURE = "radial-gradient(circle, transparent 55%, rgba(63, 200, 122, 0.55) 55%)";
const CHECK = "radial-gradient(circle, rgba(229, 82, 78, 0.85) 0%, rgba(229, 82, 78, 0.4) 70%, transparent 100%)";

export default function ChessBoard({
  position,
  onMove,
  interactive,
  lastMove,
  kingInCheckSquare,
  engineArrow,
  orientation,
  animationDuration = 200,
}: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalSquares, setLegalSquares] = useState<string[]>([]);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);

  // A new position invalidates any selection or half-finished promotion.
  useEffect(() => {
    setSelectedSquare(null);
    setLegalSquares([]);
    setPromotion(null);
  }, [position]);

  const turn = position.split(" ")[1] === "b" ? "b" : "w";

  const squareStyles = useMemo((): CustomSquareStyles => {
    const styles: Record<string, Record<string, string>> = {};
    if (lastMove) {
      styles[lastMove.from] = { backgroundColor: LAST_MOVE };
      styles[lastMove.to] = { backgroundColor: LAST_MOVE };
    }
    if (selectedSquare) styles[selectedSquare] = { backgroundColor: SELECTED };

    if (legalSquares.length > 0) {
      const chess = new Chess(position);
      for (const square of legalSquares) {
        styles[square] = { ...styles[square], background: chess.get(square as Square) ? LEGAL_CAPTURE : LEGAL_DOT };
      }
    }
    if (kingInCheckSquare) styles[kingInCheckSquare] = { background: CHECK };
    return styles;
  }, [position, lastMove, selectedSquare, legalSquares, kingInCheckSquare]);

  // react-chessboard draws its own right-click arrows next to these. It wipes them whenever this prop
  // changes identity, which is exactly what we want on a new position — and exactly what must NOT
  // happen on every render, so the array is memoised and user arrows are never fed back into it.
  const customArrows = useMemo<Arrow[]>(
    // `position` is a dependency on purpose: it gives the array a new identity per position,
    // which clears arrows the user drew on the previous one.
    () => (engineArrow ? [engineArrow] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engineArrow, position],
  );

  const select = useCallback(
    (square: Square): boolean => {
      const chess = new Chess(position);
      const piece = chess.get(square);
      if (!piece || piece.color !== chess.turn()) {
        setSelectedSquare(null);
        setLegalSquares([]);
        return false;
      }
      setSelectedSquare(square);
      setLegalSquares(chess.moves({ square, verbose: true }).map((m) => m.to));
      return true;
    },
    [position],
  );

  const handleSquareClick = useCallback(
    (square: Square) => {
      if (!interactive) return;
      const chess = new Chess(position);

      if (selectedSquare && legalSquares.includes(square)) {
        const piece = chess.get(selectedSquare);
        const promotes = piece?.type === "p" && (square[1] === "8" || square[1] === "1");
        if (promotes) setPromotion({ from: selectedSquare, to: square });
        else onMove(selectedSquare, square);
        setSelectedSquare(null);
        setLegalSquares([]);
        return;
      }
      // Anything else: (re)select one of the mover's pieces, or clear the selection.
      select(square);
    },
    [interactive, position, selectedSquare, legalSquares, onMove, select],
  );

  const handlePieceDrop = useCallback(
    (from: Square, to: Square): boolean => interactive && onMove(from, to),
    [interactive, onMove],
  );

  const handlePromotionSelect = useCallback(
    (piece?: PromotionPieceOption, fromSquare?: Square, toSquare?: Square): boolean => {
      if (!piece) return false;
      const from = promotion?.from ?? fromSquare;
      const to = promotion?.to ?? toSquare;
      if (!from || !to) return false;
      const ok = onMove(from, to, piece[1].toLowerCase());
      setPromotion(null);
      return ok;
    },
    [promotion, onMove],
  );

  return (
    <div
      className="w-full overflow-hidden rounded-lg"
      style={{ background: "var(--c-raised)", boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)" }}
    >
      <Chessboard
        position={position}
        boardOrientation={orientation}
        animationDuration={animationDuration}
        arePiecesDraggable={interactive}
        isDraggablePiece={({ piece }: { piece: Piece }) => interactive && piece[0] === turn}
        areArrowsAllowed
        customArrows={customArrows}
        customSquareStyles={squareStyles}
        onSquareClick={handleSquareClick}
        onPieceDrop={handlePieceDrop}
        onPieceDragBegin={(_piece: Piece, square: Square) => {
          select(square);
        }}
        onPieceDragEnd={() => {
          setSelectedSquare(null);
          setLegalSquares([]);
        }}
        showPromotionDialog={promotion !== null}
        promotionToSquare={promotion?.to ?? null}
        promotionDialogVariant="modal"
        onPromotionPieceSelect={handlePromotionSelect}
        customDarkSquareStyle={{ backgroundColor: "#a0785a" }}
        customLightSquareStyle={{ backgroundColor: "#ede0c8" }}
      />
    </div>
  );
}
