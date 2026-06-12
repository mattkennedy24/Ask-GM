import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import ChessBoard from "../components/ChessBoard";
import EvalBar from "../components/EvalBar";
import CapturedPieces from "../components/CapturedPieces";
import EngineLines from "../components/EngineLines";
import MoveNotation from "../components/MoveNotation";
import PositionBrief from "../components/PositionBrief";
import type { Arrow } from "react-chessboard/dist/chessboard/types";
import type { EngineLineResult } from "../hooks/useStockfish";
import type { DetectedOpening } from "../utils/openingDetection";

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
  sanMoves: string[];
  historyIndex: number;
  onNavigate: (index: number) => void;
  detectedOpening?: DetectedOpening | null;
}

const GM_COLORS: Record<string, string> = {
  Magnus: "var(--c-gm-magnus)",
  Hikaru: "var(--c-gm-hikaru)",
  Bobby:  "var(--c-gm-bobby)",
};

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
  sanMoves,
  historyIndex,
  onNavigate,
  detectedOpening,
}) => {
  const [boardFlipped, setBoardFlipped] = useState(false);
  const [selectedLine, setSelectedLine] = useState(-1);
  const [pvStep, setPvStep] = useState(-1);
  const [boardReady, setBoardReady] = useState(false);
  const prevThinkingRef = useRef(engineThinking);

  // Trigger analysis-ready ring when engine finishes
  useEffect(() => {
    if (prevThinkingRef.current && !engineThinking && topLines.length > 0) {
      setBoardReady(true);
      const t = setTimeout(() => setBoardReady(false), 750);
      return () => clearTimeout(t);
    }
    prevThinkingRef.current = engineThinking;
  }, [engineThinking, topLines.length]);

  const isPreviewing = selectedLine >= 0 && pvStep >= 0;

  const activePv = useMemo(
    () => (selectedLine >= 0 ? (topLines[selectedLine]?.pv ?? []) : []),
    [topLines, selectedLine]
  );

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
      setSelectedLine(-1);
      setPvStep(-1);
    } else {
      setSelectedLine(i);
      setPvStep(0);
    }
  }, [selectedLine]);

  const handlePvStep = useCallback((dir: 1 | -1) => {
    setPvStep((s) => {
      if (dir === -1) return s <= 0 ? 0 : s - 1;
      const next = s + 1;
      return next >= activePv.length ? s : next;
    });
  }, [activePv.length]);

  const handleExitPreview = useCallback(() => {
    setSelectedLine(-1);
    setPvStep(-1);
  }, []);

  const gmColor = GM_COLORS[selectedGM] ?? "var(--c-gold)";

  return (
    <div
      className="panel w-full overflow-hidden"
      style={{ boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}
    >
      {/* ── Position Brief strip ── */}
      <PositionBrief
        fen={position}
        evalScore={evalScore}
        mateIn={mateIn}
        detectedOpening={detectedOpening ?? null}
      />

      {/* ── Board + eval bar row ── */}
      <div className="flex gap-2 items-stretch p-3 pb-0">
        {/* Eval bar — desktop vertical */}
        <div className="hidden md:flex items-stretch w-4 shrink-0">
          <EvalBar evalScore={evalScore} mateIn={mateIn} thinking={engineThinking} />
        </div>

        {/* Board column */}
        <div className="flex-1 flex flex-col min-w-0 gap-1">
          <CapturedPieces fen={position} side="top" />
          <div className={boardReady ? "analysis-ready rounded-lg" : ""}>
            <ChessBoard
              key={isPreviewing ? `pv-${selectedLine}-${pvStep}` : "game"}
              position={isPreviewing && previewFen ? previewFen : position}
              onMove={isPreviewing ? () => false : onMove}
              lastMove={isPreviewing ? previewLastMove : lastMove}
              inCheck={inCheck}
              kingInCheckSquare={kingInCheckSquare}
              engineArrow={isPreviewing ? null : engineArrow}
              animationDuration={isPreviewing ? 0 : 200}
              boardOrientation={boardFlipped ? "black" : "white"}
            />
          </div>
          <CapturedPieces fen={position} side="bottom" />
        </div>
      </div>

      {/* ── Eval bar — mobile horizontal ── */}
      <div className="md:hidden mt-2 px-3 px-1">
        <EvalBar evalScore={evalScore} mateIn={mateIn} thinking={engineThinking} />
      </div>

      {/* ── Move notation ── */}
      {sanMoves.length > 0 && (
        <div
          className="mt-3 pt-3 px-3 pb-0"
          style={{ borderTop: "1px solid var(--c-border)" }}
        >
          <MoveNotation
            sanMoves={sanMoves}
            currentIndex={historyIndex}
            onNavigate={onNavigate}
          />
        </div>
      )}

      {/* ── Engine lines ── */}
      <div className="mt-3 px-3 pb-0">
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
        className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 px-3 pb-3"
        style={{ borderTop: "1px solid var(--c-border)" }}
      >
        {/* Navigation group */}
        <div className="flex gap-1">
          <button onClick={onBack} className="btn text-xs px-2.5 py-1.5" title="Go back one move (←)">
            ←
          </button>
          <button
            onClick={onForward}
            disabled={disableForward}
            className="btn text-xs px-2.5 py-1.5"
            title="Go forward one move (→)"
          >
            →
          </button>
        </div>

        <button onClick={onUndo} className="btn text-xs px-2.5 py-1.5">
          Undo
        </button>
        <button
          onClick={() => setBoardFlipped((f) => !f)}
          className="btn text-xs px-2.5 py-1.5"
          title="Flip board"
        >
          ⇅ Flip
        </button>

        {/* Ask GM button — right-aligned, GM-colored */}
        <button
          onClick={onAsk}
          className="btn text-xs ml-auto px-3 py-1.5 font-semibold"
          style={{
            background: `${gmColor}18`,
            borderColor: `${gmColor}66`,
            color: gmColor,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = `${gmColor}28`;
            (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 8px ${gmColor}25`;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = `${gmColor}18`;
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
          }}
        >
          Ask {selectedGM} →
        </button>
      </div>
    </div>
  );
};

export default ChessPanel;
