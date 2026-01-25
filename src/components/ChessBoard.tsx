import React from "react";
import { Chessboard } from "react-chessboard";

interface ChessBoardProps {
  position: string;
  onMove: (from: string, to: string) => boolean;
  onFenChange?: (fen: string) => void;
}

const ChessBoard: React.FC<ChessBoardProps> = ({ position, onMove }) => {
  // The parent manages the game state and passes FEN and onMove
    return (
      <div className="rounded-lg shadow-lg p-2 bg-zinc-800 w-[400px]">
    <Chessboard
      position={position}
      onPieceDrop={(sourceSquare, targetSquare) => {
        return onMove(sourceSquare, targetSquare);
      }}
    />
    </div>
  );
};

export default ChessBoard;
