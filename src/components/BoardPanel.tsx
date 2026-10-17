import { type ReactNode, useEffect, useState } from "react";
import type { Arrow } from "react-chessboard/dist/chessboard/types";
import { evalLabel, whiteShare } from "../lib/evaluation";
import { type GameOutcome, describeOutcome, outcomeWhiteShare } from "../lib/outcome";
import CapturedPieces from "./CapturedPieces";
import ChessBoard from "./ChessBoard";
import EvalBar from "./EvalBar";
import PositionBrief from "./PositionBrief";
import { ArrowLeft, ArrowRight, Flip, Undo } from "./icons";

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
  /** Set once the game is over; replaces the evaluation. */
  outcome: GameOutcome | null;
  /** Whether missing pieces were captured in this game (false for a position pasted from a FEN). */
  capturesKnown: boolean;

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
  /** The end-of-game card, when there is one. */
  result?: ReactNode;
  /** The line under the controls: how the last move was judged, or the lesson note. */
  feedback: ReactNode;
}

/** The board and everything that belongs to it: evaluation, captures, the controls and a line of feedback. */
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
  outcome,
  capturesKnown,
  canBack,
  canForward,
  onBack,
  onForward,
  onUndo,
  gmName,
  onAsk,
  askDisabled,
  extraControls,
  result,
  feedback,
}: BoardPanelProps) {
  const [flipped, setFlipped] = useState(false);

  // While a new position is being analysed the bar keeps the last value instead of snapping back to "equal".
  const [held, setHeld] = useState<{ score: number | null; mate: number | null }>({ score: null, mate: null });
  useEffect(() => {
    if (score !== null || mate !== null) setHeld({ score, mate });
  }, [score, mate]);
  const fresh = score !== null || mate !== null;
  const shown = fresh ? { score, mate } : held;

  const share = outcome ? outcomeWhiteShare(outcome) : whiteShare(shown.score, shown.mate);
  const label = outcome ? describeOutcome(outcome) : evalLabel(shown.score, shown.mate);
  const stale = !outcome && !fresh && thinking;

  return (
    <section className="board-panel" aria-label="Board">
      <PositionBrief fen={fen} score={score} mate={mate} thinking={thinking} outcome={outcome} />

      <div className="board-stage">
        <div className="board-row">
          <div className="hidden desk:block">
            <EvalBar whiteShare={share} label={label} orientation="vertical" flipped={flipped} stale={stale} />
          </div>
          <div className="board-frame" role="group" aria-label="Chess board">
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

        <div className="desk:hidden">
          <EvalBar whiteShare={share} label={label} orientation="horizontal" flipped={flipped} stale={stale} />
        </div>

        <CapturedPieces fen={fen} known={capturesKnown} flipped={flipped} />
      </div>

      <div className="controls">
        <button type="button" className="btn btn-icon" onClick={onBack} disabled={!canBack} aria-label="Previous move" title="Previous move (←)">
          <ArrowLeft size={18} />
        </button>
        <button type="button" className="btn btn-icon" onClick={onForward} disabled={!canForward} aria-label="Next move" title="Next move (→)">
          <ArrowRight size={18} />
        </button>
        {onUndo && (
          <button type="button" className="btn btn-icon" onClick={onUndo} disabled={!canBack} aria-label="Take back the last move" title="Take back the last move">
            <Undo size={18} />
          </button>
        )}
        {extraControls}
        <button type="button" className="btn btn-icon" onClick={() => setFlipped((value) => !value)} aria-label="Flip the board" aria-pressed={flipped} title="Flip the board">
          <Flip size={18} />
        </button>

        <button type="button" className="btn btn-primary controls-ask" onClick={onAsk} disabled={askDisabled}>
          Ask {gmName}
        </button>
      </div>

      {result}
      {feedback}
    </section>
  );
}
