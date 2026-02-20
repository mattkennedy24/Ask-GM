import React, { useState, useCallback, useMemo } from "react";
import { Chess } from "chess.js";
import ChessBoard from "../components/ChessBoard";
import EvalBar from "../components/EvalBar";
import CapturedPieces from "../components/CapturedPieces";
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
  /** Centipawn evaluation from engine */
  evalScore: number | null;
  /** Forced mate (positive = white wins) */
  mateIn: number | null;
  /** Whether the engine is currently thinking */
  engineThinking: boolean;
  /** Principal variation – UCI move strings */
  pvLine: string[];
}

/** Convert up to `maxMoves` UCI moves from `fen` into SAN notation. */
function pvToSan(fen: string, pvMoves: string[], maxMoves = 8): string[] {
  const chess = new Chess(fen);
  const san: string[] = [];
  for (const uci of pvMoves.slice(0, maxMoves)) {
    try {
      const result = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4] ?? "q",
      });
      if (result) san.push(result.san);
    } catch {
      break;
    }
  }
  return san;
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
  pvLine,
}) => {
  const [showBestLine, setShowBestLine] = useState(false);
  // Preview: step through PV on the board without affecting game history
  const [pvStep, setPvStep] = useState<number>(-1); // -1 = not previewing
  const isPreviewing = pvStep >= 0;

  // SAN version of the PV for display
  const pvSan = useMemo(
    () => (pvLine.length > 0 ? pvToSan(position, pvLine) : []),
    [position, pvLine]
  );

  // Board position when previewing PV
  const previewFen = useMemo(() => {
    if (!isPreviewing || pvLine.length === 0) return null;
    const chess = new Chess(position);
    for (let i = 0; i <= pvStep && i < pvLine.length; i++) {
      const uci = pvLine[i];
      try {
        chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? "q" });
      } catch {
        break;
      }
    }
    return chess.fen();
  }, [position, pvLine, pvStep, isPreviewing]);

  // The last move arrow while previewing
  const previewLastMove = useMemo(() => {
    if (!isPreviewing || pvStep < 0) return null;
    const uci = pvLine[pvStep];
    if (!uci || uci.length < 4) return null;
    return { from: uci.slice(0, 2), to: uci.slice(2, 4) };
  }, [isPreviewing, pvStep, pvLine]);

  const handleToggleBestLine = () => {
    if (showBestLine) {
      setShowBestLine(false);
      setPvStep(-1);
    } else {
      setShowBestLine(true);
    }
  };

  const handleExitPreview = useCallback(() => {
    setPvStep(-1);
  }, []);

  const handlePvStep = useCallback(
    (dir: 1 | -1) => {
      setPvStep((s) => {
        const next = s + dir;
        if (next < 0) return -1;
        if (next >= pvLine.length) return s;
        return next;
      });
    },
    [pvLine.length]
  );

  const hasPv = pvSan.length > 0;

  // Move labels with numbers like real chess notation: "1. e4  e5  2. Nf3"
  const pvFormatted = useMemo(() => {
    const chess = new Chess();
    let moveNum = chess.moveNumber();
    let isWhiteTurn = chess.turn() === "w";

    // Determine starting move number from position
    const pos = new Chess(position);
    moveNum = pos.moveNumber();
    isWhiteTurn = pos.turn() === "w";

    return pvSan.map((san, i) => {
      const num = moveNum + Math.floor((i + (isWhiteTurn ? 0 : 1)) / 2);
      const isWhite = isWhiteTurn ? i % 2 === 0 : i % 2 === 1;
      return { san, num, isWhite, idx: i };
    });
  }, [pvSan, position]);

  return (
    <div className="border-4 border-zinc-600 rounded-xl p-3 shadow-xl bg-zinc-800 w-full">
      {/* Board + eval bar row */}
      <div className="flex gap-2 items-stretch">
        {/* Eval bar (desktop – vertical) */}
        <div className="hidden md:flex items-stretch">
          <EvalBar evalScore={evalScore} mateIn={mateIn} thinking={engineThinking} />
        </div>

        {/* Board column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Captured pieces – Black's lost pieces (shown above board) */}
          <CapturedPieces fen={position} side="top" />

          <ChessBoard
            position={isPreviewing && previewFen ? previewFen : position}
            onMove={isPreviewing ? () => false : onMove}
            lastMove={isPreviewing ? previewLastMove : lastMove}
            inCheck={inCheck}
            kingInCheckSquare={kingInCheckSquare}
            engineArrow={isPreviewing ? null : engineArrow}
          />

          {/* Captured pieces – White's lost pieces (shown below board) */}
          <CapturedPieces fen={position} side="bottom" />
        </div>
      </div>

      {/* Eval bar (mobile – horizontal) */}
      <div className="md:hidden mt-2 px-1">
        <EvalBar evalScore={evalScore} mateIn={mateIn} thinking={engineThinking} />
      </div>

      {/* Best Line Panel */}
      {showBestLine && (
        <div className="mt-3 p-3 bg-zinc-900 rounded-lg border border-zinc-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">
              Engine Best Line
            </span>
            <button
              onClick={() => { setShowBestLine(false); setPvStep(-1); }}
              className="text-zinc-500 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>

          {hasPv ? (
            <>
              {/* Move tokens */}
              <div className="flex flex-wrap gap-x-2 gap-y-1 text-sm font-mono mb-3">
                {pvFormatted.map(({ san, num, isWhite, idx }) => (
                  <React.Fragment key={idx}>
                    {isWhite && (
                      <span className="text-zinc-600">{num}.</span>
                    )}
                    <button
                      onClick={() => setPvStep(idx)}
                      className={`rounded px-1 transition-colors ${
                        pvStep === idx
                          ? "bg-blue-600 text-white"
                          : "text-zinc-200 hover:bg-zinc-700"
                      }`}
                    >
                      {san}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              {/* Step controls */}
              {isPreviewing ? (
                <div className="flex gap-2 items-center flex-wrap">
                  <button className="btn text-xs" onClick={() => handlePvStep(-1)} disabled={pvStep <= 0}>
                    ← Prev
                  </button>
                  <button className="btn text-xs" onClick={() => handlePvStep(1)} disabled={pvStep >= pvLine.length - 1}>
                    Next →
                  </button>
                  <button className="btn text-xs bg-red-800 hover:bg-red-700" onClick={handleExitPreview}>
                    Back to Game
                  </button>
                  <span className="text-xs text-zinc-500">
                    Move {pvStep + 1}/{pvLine.length}
                  </span>
                </div>
              ) : (
                <button
                  className="btn text-xs bg-green-800 hover:bg-green-700"
                  onClick={() => setPvStep(0)}
                >
                  ▶ Step Through
                </button>
              )}
            </>
          ) : (
            <p className="text-zinc-500 text-xs">
              {engineThinking ? "Analysing…" : "No line available yet."}
            </p>
          )}
        </div>
      )}

      {/* Control buttons */}
      <div className="flex flex-wrap justify-between mt-3 gap-2">
        <button onClick={onBack} className="btn text-sm">← Back</button>
        <button onClick={onForward} disabled={disableForward} className="btn text-sm disabled:opacity-50">→ Forward</button>
        <button onClick={onUndo} className="btn text-sm">Undo</button>
        <button
          onClick={handleToggleBestLine}
          className={`btn text-sm ${showBestLine ? "bg-amber-700 hover:bg-amber-600" : "bg-zinc-600 hover:bg-zinc-500"}`}
          title="Show engine's best continuation"
        >
          {showBestLine ? "Hide Line" : "Best Line"}
        </button>
        <button onClick={onAsk} className="btn text-sm bg-blue-600 hover:bg-blue-700">
          Ask {selectedGM}
        </button>
      </div>
    </div>
  );
};

export default ChessPanel;
