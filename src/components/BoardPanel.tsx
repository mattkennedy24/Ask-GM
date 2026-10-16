import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Arrow } from "react-chessboard/dist/chessboard/types";
import CapturedPieces from "./CapturedPieces";
import ChessBoard from "./ChessBoard";
import EvalBar from "./EvalBar";
import PositionBrief from "./PositionBrief";
import { ArrowLeft, ArrowRight, Flip, Send, Undo } from "./icons";

interface BoardPanelProps {
  /** The position to show. */
  fen: string;
  interactive: boolean;
  onMove: (from: string, to: string, promotion?: string) => boolean;
  lastMove: { from: string; to: string } | null;
  kingInCheckSquare: string | null;
  engineArrow: Arrow | null;

  score: number | null;
  mate: number | null;
  thinking: boolean;
  hasAnalysis: boolean;

  canBack: boolean;
  canForward: boolean;
  onBack: () => void;
  onForward: () => void;
  /** Omitted where taking back a move makes no sense (opening lessons). */
  onUndo?: () => void;

  gmName: string;
  onAsk: () => void;
  askDisabled: boolean;

  /** Extra buttons in the control row (e.g. lesson auto-play). */
  extraControls?: ReactNode;
  /** Shown under the controls (e.g. the coaching note for the current lesson move). */
  footer?: ReactNode;
}

/** The board and everything that belongs to it: evaluation, captures and the controls under it. */
export default function BoardPanel({
  fen,
  interactive,
  onMove,
  lastMove,
  kingInCheckSquare,
  engineArrow,
  score,
  mate,
  thinking,
  hasAnalysis,
  canBack,
  canForward,
  onBack,
  onForward,
  onUndo,
  gmName,
  onAsk,
  askDisabled,
  extraControls,
  footer,
}: BoardPanelProps) {
  const [flipped, setFlipped] = useState(false);
  const [ringing, setRinging] = useState(false);
  const wasThinking = useRef(thinking);

  // A brief green ring when the engine finishes a position: it tells you the arrow is final.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (wasThinking.current && !thinking && hasAnalysis) {
      setRinging(true);
      timer = setTimeout(() => setRinging(false), 750);
    }
    wasThinking.current = thinking;
    return () => clearTimeout(timer);
  }, [thinking, hasAnalysis]);

  // The row above the board belongs to whoever sits at the top of it.
  const topCaptures = flipped ? "w" : "b";
  const bottomCaptures = flipped ? "b" : "w";

  return (
    <div className="panel overflow-hidden handheld:rounded-none handheld:border-x-0">
      <PositionBrief fen={fen} score={score} mate={mate} thinking={thinking} />

      <div className="flex flex-col gap-1 px-0 pb-1 pt-2 desk:px-3">
        <div className="px-3 desk:px-0 desk:pl-6">
          <CapturedPieces fen={fen} capturedBy={topCaptures} />
        </div>

        <div className="flex items-stretch gap-2">
          <div className="hidden w-4 shrink-0 desk:block">
            <EvalBar score={score} mate={mate} thinking={thinking} orientation="vertical" flipped={flipped} />
          </div>
          <div className={`min-w-0 flex-1 rounded-lg ${ringing ? "analysis-ready" : ""}`} role="group" aria-label="Chess board">
            <ChessBoard
              position={fen}
              onMove={onMove}
              interactive={interactive}
              lastMove={lastMove}
              kingInCheckSquare={kingInCheckSquare}
              engineArrow={engineArrow}
              orientation={flipped ? "black" : "white"}
            />
          </div>
        </div>

        <div className="px-3 desk:px-0 desk:pl-6">
          <CapturedPieces fen={fen} capturedBy={bottomCaptures} />
        </div>

        <div className="px-3 pt-1 desk:hidden">
          <EvalBar score={score} mate={mate} thinking={thinking} orientation="horizontal" flipped={flipped} />
        </div>
      </div>

      <div className="flex items-center gap-1.5 px-3 pb-3 pt-2">
        <button type="button" className="btn btn-icon" onClick={onBack} disabled={!canBack} aria-label="Previous move" title="Previous move (←)">
          <ArrowLeft size={16} />
        </button>
        <button type="button" className="btn btn-icon" onClick={onForward} disabled={!canForward} aria-label="Next move" title="Next move (→)">
          <ArrowRight size={16} />
        </button>
        {onUndo && (
          <button type="button" className="btn btn-icon" onClick={onUndo} disabled={!canBack} aria-label="Take back the last move" title="Take back the last move">
            <Undo size={16} />
          </button>
        )}
        {extraControls}
        <button type="button" className="btn btn-icon" onClick={() => setFlipped((f) => !f)} aria-label="Flip the board" aria-pressed={flipped} title="Flip the board">
          <Flip size={16} />
        </button>

        <button type="button" className="btn btn-gm ml-auto font-semibold" onClick={onAsk} disabled={askDisabled}>
          Ask {gmName} <Send size={15} />
        </button>
      </div>

      {footer && <div className="px-3 pb-3">{footer}</div>}
    </div>
  );
}
