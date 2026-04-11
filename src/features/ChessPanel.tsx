import React, { useState, useCallback, useMemo } from "react";
import { Chess } from "chess.js";
import ChessBoard from "../components/ChessBoard";
import EvalBar from "../components/EvalBar";
import CapturedPieces from "../components/CapturedPieces";
import EngineLines from "../components/EngineLines";
import type { Arrow } from "react-chessboard/dist/chessboard/types";
import type { EngineLineResult } from "../hooks/useStockfish";

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
  evalScore: number | null;
  mateIn: number | null;
  engineThinking: boolean;
  topLines: EngineLineResult[];
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
  evalScore,
  mateIn,
  engineThinking,
  topLines,
}) => {
  // Which engine line is selected for preview (-1 = none)
  const [selectedLine, setSelectedLine] = useState(-1);
  // Which move within the selected line we're previewing (-1 = not yet stepping)
  const [pvStep, setPvStep] = useState(-1);

  const isPreviewing = selectedLine >= 0 && pvStep >= 0;

  const activePv = useMemo(
    () => (selectedLine >= 0 ? (topLines[selectedLine]?.pv ?? []) : []),
    [topLines, selectedLine]
  );

  // Board FEN while stepping through a line
  const previewFen = useMemo(() => {
    if (!isPreviewing || activePv.length === 0) return null;
    const chess = new Chess(position);
    for (let i = 0; i <= pvStep && i < activePv.length; i++) {
      const uci = activePv[i];
      try {
        chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? "q" });
      } catch { break; }
    }
    return chess.fen();
  }, [position, activePv, pvStep, isPreviewing]);

  const previewLastMove = useMemo(() => {
    if (!isPreviewing || pvStep < 0) return null;
    const uci = activePv[pvStep];
    if (!uci || uci.length < 4) return null;
    return { from: uci.slice(0, 2), to: uci.slice(2, 4) };
  }, [isPreviewing, pvStep, activePv]);

  const handleSelectLine = useCallback((i: number) => {
    if (i === selectedLine) {
      // Toggle off
      setSelectedLine(-1);
      setPvStep(-1);
    } else {
      setSelectedLine(i);
      setPvStep(0); // Auto-preview first move
    }
  }, [selectedLine]);

  const handlePvStep = useCallback((dir: 1 | -1) => {
    setPvStep((s) => {
      if (dir === -1) {
        const next = s - 1;
        return next < 0 ? 0 : next;
      }
      const next = s + 1;
      return next >= activePv.length ? s : next;
    });
  }, [activePv.length]);

  const handleExitPreview = useCallback(() => {
    setSelectedLine(-1);
    setPvStep(-1);
  }, []);

  const gmColor: Record<string, string> = {
    Magnus: "var(--c-gm-magnus)",
    Hikaru: "var(--c-gm-hikaru)",
    Bobby:  "var(--c-gm-bobby)",
  };

  return (
    <div
      className="panel p-3 shadow-2xl w-full"
      style={{ boxShadow: "0 16px 48px rgba(0,0,0,0.7)" }}
    >
      {/* ── Board + eval bar row ── */}
      <div className="flex gap-2 items-stretch">
        {/* Eval bar — desktop vertical */}
        <div className="hidden md:flex items-stretch w-4 shrink-0">
          <EvalBar evalScore={evalScore} mateIn={mateIn} thinking={engineThinking} />
        </div>

        {/* Board column */}
        <div className="flex-1 flex flex-col min-w-0 gap-1">
          <CapturedPieces fen={position} side="top" />

          <ChessBoard
            key={isPreviewing ? `pv-${selectedLine}-${pvStep}` : "game"}
            position={isPreviewing && previewFen ? previewFen : position}
            onMove={isPreviewing ? () => false : onMove}
            lastMove={isPreviewing ? previewLastMove : lastMove}
            inCheck={inCheck}
            kingInCheckSquare={kingInCheckSquare}
            engineArrow={isPreviewing ? null : engineArrow}
            animationDuration={isPreviewing ? 0 : 200}
          />

          <CapturedPieces fen={position} side="bottom" />
        </div>
      </div>

      {/* ── Eval bar — mobile horizontal ── */}
      <div className="md:hidden mt-2 px-1">
        <EvalBar evalScore={evalScore} mateIn={mateIn} thinking={engineThinking} />
      </div>

      {/* ── Engine lines ── */}
      <div className="mt-3">
        <EngineLines
          topLines={topLines}
          currentFen={position}
          thinking={engineThinking}
          selectedLine={selectedLine}
          pvStep={pvStep}
          onSelectLine={handleSelectLine}
          onPvStep={handlePvStep}
          onExitPreview={handleExitPreview}
        />
      </div>

      {/* ── Control buttons ── */}
      <div
        className="flex flex-wrap gap-2 mt-3 pt-3"
        style={{ borderTop: "1px solid var(--c-border)" }}
      >
        <button onClick={onBack} className="btn text-sm">← Back</button>
        <button
          onClick={onForward}
          disabled={disableForward}
          className="btn text-sm"
        >
          Forward →
        </button>
        <button onClick={onUndo} className="btn text-sm">Undo</button>
        <button
          onClick={onAsk}
          className="btn text-sm ml-auto"
          style={{
            background: `${gmColor[selectedGM] ?? "var(--c-gold)"}18`,
            borderColor: `${gmColor[selectedGM] ?? "var(--c-gold)"}66`,
            color: gmColor[selectedGM] ?? "var(--c-gold)",
          }}
        >
          Ask {selectedGM}
        </button>
      </div>
    </div>
  );
};

export default ChessPanel;
