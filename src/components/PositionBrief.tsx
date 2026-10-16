import { useMemo } from "react";
import { Chess } from "chess.js";
import { evalLabel, evalSide, formatEvalValue } from "../lib/evaluation";
import { summarizeMaterial } from "../lib/material";

interface PositionBriefProps {
  fen: string;
  score: number | null;
  mate: number | null;
  thinking: boolean;
}

/** A one-line read on the position: whose move, the engine's verdict, and the material balance. */
export default function PositionBrief({ fen, score, mate, thinking }: PositionBriefProps) {
  const { moveNumber, turn, lead } = useMemo(() => {
    try {
      const chess = new Chess(fen);
      return { moveNumber: chess.moveNumber(), turn: chess.turn(), lead: summarizeMaterial(fen).advantage };
    } catch {
      return { moveNumber: 1, turn: "w" as const, lead: 0 };
    }
  }, [fen]);

  const label = evalLabel(score, mate);
  const side = evalSide(score, mate);
  const hasEval = score !== null || mate !== null;

  return (
    <div
      className="flex items-center gap-x-3 gap-y-1 px-3 py-1.5"
      style={{ borderBottom: "1px solid var(--c-border)", fontFamily: "var(--f-mono)", fontSize: "0.75rem", minHeight: "2.25rem" }}
    >
      <span className="shrink-0" style={{ color: "var(--c-text-soft)" }}>
        <span style={{ color: "var(--c-text-muted)" }}>Move</span> {moveNumber}
        <span aria-hidden="true" style={{ color: "var(--c-text-muted)" }}> · </span>
        <span style={{ color: "var(--c-text)" }}>{turn === "w" ? "White" : "Black"}</span>
      </span>

      <span
        className="flex shrink-0 items-baseline gap-1.5"
        aria-live="polite"
        style={{ opacity: hasEval || !thinking ? 1 : 0.5, transition: "opacity 200ms ease" }}
      >
        <span
          className="tabular-nums"
          style={{
            fontSize: "0.9375rem",
            fontWeight: 700,
            color: side === "equal" ? "var(--c-text-soft)" : "var(--c-text)",
            minWidth: "3.25rem",
          }}
        >
          {hasEval ? formatEvalValue(score, mate) : thinking ? "…" : "—"}
        </span>
        {label && <span style={{ color: "var(--c-text-muted)" }}>{label}</span>}
      </span>

      {lead !== 0 && (
        <span className="ml-auto shrink-0" style={{ color: "var(--c-text-muted)" }}>
          {lead > 0 ? "W" : "B"}+{Math.abs(lead)}
        </span>
      )}
    </div>
  );
}
