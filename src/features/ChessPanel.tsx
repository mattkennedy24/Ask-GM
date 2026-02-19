import React from "react";
import ChessBoard from "../components/ChessBoard";
import type { Arrow } from "react-chessboard/dist/chessboard/types";

interface ChessPanelProps {
  position: string;
  onMove: (from: string, to: string, promotion?: string) => boolean;
  onBack: () => void;
  onForward: () => void;
  onUndo: () => void;
  onAsk: () => void;
  selectedGM: string;
  disableForward: boolean;
  lastMove: { from: string; to: string } | null;
  inCheck: boolean;
  kingInCheckSquare: string | null;
  engineArrow: Arrow | null;
}

const ChessPanel: React.FC<ChessPanelProps> = ({
  position,
  onMove,
  onBack,
  onForward,
  onUndo,
  onAsk,
  selectedGM,
  disableForward,
  lastMove,
  inCheck,
  kingInCheckSquare,
  engineArrow,
}) => {
  return (
      <div className="border-4 border-zinc-600 rounded-xl p-4 shadow-xl bg-zinc-800 w-full max-w-[615px]">
      <ChessBoard
        position={position}
        onMove={onMove}
        lastMove={lastMove}
        inCheck={inCheck}
        kingInCheckSquare={kingInCheckSquare}
        engineArrow={engineArrow}
      />
      <div className="flex justify-between mt-4 gap-2">
        <button onClick={onBack} className="btn">← Back</button>
        <button onClick={onForward} disabled={disableForward} className="btn disabled:opacity-50">→ Forward</button>
        <button onClick={onUndo} className="btn">Undo</button>
        <button onClick={onAsk} className="btn bg-blue-600 hover:bg-blue-700">
          Ask {selectedGM}
        </button>
      </div>
    </div>
  );
};

export default ChessPanel;
