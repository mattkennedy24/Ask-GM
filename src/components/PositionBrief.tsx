import React, { useMemo } from "react";
import { Chess } from "chess.js";
import type { DetectedOpening } from "../utils/openingDetection";

interface PositionBriefProps {
  fen: string;
  evalScore: number | null;
  mateIn: number | null;
  detectedOpening: DetectedOpening | null;
}

function evalLabel(score: number | null, mate: number | null): string {
  if (mate !== null) return mate > 0 ? "Winning" : "Losing";
  if (score === null) return "";
  const abs = Math.abs(score);
  if (score >= 300)  return "Winning";
  if (score >= 100)  return "Advantage";
  if (score >= 25)   return "Slight edge";
  if (abs <= 24)     return "Equal";
  if (score > -100)  return "Slight risk";
  if (score > -300)  return "Disadvantage";
  return "Losing";
}

function evalLabelColor(score: number | null, mate: number | null): string {
  if (mate !== null) return mate > 0 ? "var(--c-line1)" : "var(--c-gm-bobby)";
  if (score === null) return "var(--c-text-muted)";
  if (score >= 100)  return "var(--c-line1)";
  if (score >= 25)   return "var(--c-line1)";
  if (score > -25)   return "var(--c-text-soft)";
  if (score > -100)  return "var(--c-line2)";
  return "var(--c-gm-bobby)";
}

function getMaterialBalance(fen: string): string {
  const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  try {
    const chess = new Chess(fen);
    let w = 0, b = 0;
    for (const row of chess.board()) {
      for (const piece of row) {
        if (!piece || piece.type === "k") continue;
        const val = PIECE_VALUES[piece.type] ?? 0;
        if (piece.color === "w") w += val; else b += val;
      }
    }
    const diff = w - b;
    if (diff === 0) return "";
    const side = diff > 0 ? "W" : "B";
    return `${side}+${Math.abs(diff)}`;
  } catch {
    return "";
  }
}

const PositionBrief: React.FC<PositionBriefProps> = ({ fen, evalScore, mateIn, detectedOpening }) => {
  const { moveNum, sideToMove, label, labelColor, material, openingShort } = useMemo(() => {
    let moveNum = 1;
    let sideToMove = "W";
    try {
      const chess = new Chess(fen);
      moveNum = chess.moveNumber();
      sideToMove = chess.turn() === "w" ? "W" : "B";
    } catch { /* ignore */ }

    const label = evalLabel(evalScore, mateIn);
    const labelColor = evalLabelColor(evalScore, mateIn);
    const material = getMaterialBalance(fen);
    const openingShort = detectedOpening
      ? detectedOpening.name.split(" — ")[0]
      : null;

    return { moveNum, sideToMove, label, labelColor, material, openingShort };
  }, [fen, evalScore, mateIn, detectedOpening]);

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 overflow-hidden"
      style={{
        background: "var(--c-surface)",
        borderBottom: "1px solid var(--c-border)",
        fontFamily: "var(--f-mono)",
      }}
    >
      {/* Move number + side */}
      <span className="text-xs shrink-0" style={{ color: "var(--c-text-muted)" }}>
        <span style={{ color: "var(--c-text-soft)" }}>#{moveNum}</span>
        <span className="mx-1" style={{ opacity: 0.4 }}>·</span>
        <span
          className="font-semibold"
          style={{ color: sideToMove === "W" ? "#F0E8D8" : "var(--c-text-muted)" }}
        >
          {sideToMove}
        </span>
      </span>

      {/* Eval label */}
      {label && (
        <>
          <span style={{ color: "var(--c-border-bright)", fontSize: "10px" }}>|</span>
          <span
            className="text-xs font-semibold shrink-0"
            style={{ color: labelColor }}
          >
            {label}
          </span>
        </>
      )}

      {/* Material */}
      {material && (
        <>
          <span style={{ color: "var(--c-border-bright)", fontSize: "10px" }}>|</span>
          <span className="text-xs shrink-0" style={{ color: "var(--c-text-muted)" }}>
            {material}
          </span>
        </>
      )}

      {/* Opening name — desktop: full, mobile: truncated */}
      {openingShort && (
        <>
          <span className="hidden sm:inline" style={{ color: "var(--c-border-bright)", fontSize: "10px" }}>|</span>
          <span
            className="hidden sm:inline text-xs overflow-hidden text-ellipsis whitespace-nowrap"
            style={{
              color: "var(--c-gold)",
              fontFamily: "var(--f-sans)",
              minWidth: 0,
              maxWidth: "180px",
            }}
            title={detectedOpening?.name}
          >
            {openingShort}
          </span>
        </>
      )}
    </div>
  );
};

export default PositionBrief;
