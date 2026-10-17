import { useMemo } from "react";
import { Chess } from "chess.js";
import { evalLabel, formatEvalValue } from "../lib/evaluation";
import { type GameOutcome, outcomeNotation } from "../lib/outcome";

interface PositionBriefProps {
  fen: string;
  score: number | null;
  mate: number | null;
  thinking: boolean;
  outcome: GameOutcome | null;
}

/** A one-line read on the position: whose move it is, and what the engine makes of it (or how the game ended). */
export default function PositionBrief({ fen, score, mate, thinking, outcome }: PositionBriefProps) {
  const { moveNumber, turn } = useMemo(() => {
    try {
      const chess = new Chess(fen);
      return { moveNumber: chess.moveNumber(), turn: chess.turn() };
    } catch {
      return { moveNumber: 1, turn: "w" as const };
    }
  }, [fen]);

  const hasEval = score !== null || mate !== null;
  const label = evalLabel(score, mate);

  return (
    <div className="brief">
      <p className="type-label">
        {outcome ? (
          "Game over"
        ) : (
          <>
            <span className="muted">Move {moveNumber}</span>
            <span aria-hidden="true" className="muted">
              {" · "}
            </span>
            {turn === "w" ? "White" : "Black"} to play
          </>
        )}
      </p>

      {outcome ? (
        <p className="brief-eval stamp" key={outcomeNotation(outcome)}>
          <span className="type-title num">{outcomeNotation(outcome)}</span>
        </p>
      ) : (
        <p className="brief-eval" aria-live="polite" data-pending={!hasEval && thinking ? "" : undefined}>
          <span className="type-title num">{hasEval ? formatEvalValue(score, mate) : thinking ? "…" : "—"}</span>
          {label && <span className="type-small muted">{label}</span>}
        </p>
      )}
    </div>
  );
}
