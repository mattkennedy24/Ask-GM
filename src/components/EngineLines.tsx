import React, { useMemo } from "react";
import { Chess } from "chess.js";
import type { EngineLineResult } from "../hooks/useStockfish";

interface EngineLinesProps {
  topLines: EngineLineResult[];
  currentFen: string;
  thinking: boolean;
  selectedLine: number;
  pvStep: number;
  onSelectLine: (i: number) => void;
  onPvStep: (dir: 1 | -1) => void;
  onExitPreview: () => void;
}

const LINE_THEME = [
  { color: "var(--c-line1)", bg: "var(--c-line1-bg)", border: "var(--c-line1-border)" },
  { color: "var(--c-line2)", bg: "var(--c-line2-bg)", border: "var(--c-line2-border)" },
  { color: "var(--c-line3)", bg: "var(--c-line3-bg)", border: "var(--c-line3-border)" },
];

function formatEval(score: number | null, mate: number | null): string {
  if (mate !== null) return mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`;
  if (score === null) return "—";
  if (score >= 9999) return "M";
  if (score <= -9999) return "-M";
  const abs = Math.abs(score / 100).toFixed(2);
  return score > 0 ? `+${abs}` : score < 0 ? `-${abs}` : "0.00";
}

function evalLabel(score: number | null, mate: number | null): string {
  if (mate !== null) return mate > 0 ? "Winning" : "Losing";
  if (score === null) return "Unknown";
  if (score >= 300)  return "Winning";
  if (score >= 100)  return "Advantage";
  if (score >= 25)   return "Slight edge";
  if (score > -25)   return "Equal";
  if (score > -100)  return "Slight risk";
  if (score > -300)  return "Disadvantage";
  return "Losing";
}

interface LineToken {
  text: string;
  kind: "number" | "move";
  moveIdx: number;
}

function buildTokens(fen: string, pvMoves: string[], maxMoves = 6): LineToken[] {
  const chess = new Chess(fen);
  const tokens: LineToken[] = [];

  pvMoves.slice(0, maxMoves).forEach((uci, i) => {
    try {
      const isWhiteTurn = chess.turn() === "w";
      const moveNum = chess.moveNumber();

      if (isWhiteTurn) {
        tokens.push({ text: `${moveNum}.`, kind: "number", moveIdx: -1 });
      } else if (i === 0) {
        tokens.push({ text: `${moveNum}…`, kind: "number", moveIdx: -1 });
      }

      const result = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? "q" });
      if (!result) return;

      tokens.push({ text: result.san, kind: "move", moveIdx: i });
    } catch {
      // stop on illegal move
    }
  });

  return tokens;
}

const EngineLines: React.FC<EngineLinesProps> = ({
  topLines,
  currentFen,
  thinking,
  selectedLine,
  pvStep,
  onSelectLine,
  onPvStep,
  onExitPreview,
}) => {
  const processedLines = useMemo(() => {
    return topLines.map((line) => ({
      ...line,
      evalStr: formatEval(line.score, line.mate),
      label: evalLabel(line.score, line.mate),
      tokens: buildTokens(currentFen, line.pv, 7),
    }));
  }, [topLines, currentFen]);

  const isPreviewing = selectedLine >= 0 && pvStep >= 0;
  const activePvLength = selectedLine >= 0 ? (topLines[selectedLine]?.pv.length ?? 0) : 0;

  return (
    <div className="panel overflow-hidden">
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: "1px solid var(--c-border)" }}
      >
        <span
          className="text-xs font-semibold tracking-[0.12em] uppercase"
          style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-mono)" }}
        >
          Engine
        </span>
        {thinking && (
          <span className="flex items-end gap-0.5 h-3">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="thinking-bar inline-block w-0.5 rounded-full"
                style={{
                  height: i === 1 ? "10px" : "6px",
                  background: "var(--c-text-muted)",
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </span>
        )}
      </div>

      {/* ── Move cards ── */}
      <div className="p-2 space-y-1.5">
        {processedLines.length === 0 ? (
          <div
            className="py-4 text-center text-xs"
            style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-mono)" }}
          >
            {thinking ? "Analysing position…" : "No lines available"}
          </div>
        ) : (
          processedLines.map((line, i) => {
            const theme = LINE_THEME[i] ?? LINE_THEME[2];
            const isSelected = selectedLine === i;

            // Split tokens: first move vs rest
            const firstMoveToken = line.tokens.find((t) => t.kind === "move" && t.moveIdx === 0);
            const restTokens = line.tokens.filter((t) => t !== firstMoveToken || t.moveIdx !== 0);
            // Number token before the first move (may be the very first token)
            const numToken = line.tokens[0]?.kind === "number" ? line.tokens[0] : null;

            return (
              <button
                key={i}
                onClick={() => onSelectLine(isSelected ? -1 : i)}
                className="w-full text-left rounded-lg transition-all duration-150 engine-card overflow-hidden"
                style={{
                  background: isSelected ? theme.bg : "var(--c-surface)",
                  border: `1px solid ${isSelected ? theme.border : "var(--c-border)"}`,
                }}
              >
                {/* ── Card top: eval + first move ── */}
                <div className="flex items-center gap-2.5 px-3 py-2">
                  {/* Eval section */}
                  <div className="flex flex-col items-start shrink-0" style={{ minWidth: "80px" }}>
                    <span
                      className="text-xs font-semibold tabular-nums leading-tight"
                      style={{ color: theme.color, fontFamily: "var(--f-mono)" }}
                    >
                      {line.evalStr}
                    </span>
                    <span
                      className="text-xs leading-tight mt-0.5"
                      style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-sans)", fontSize: "10px" }}
                    >
                      {line.label}
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="self-stretch w-px shrink-0" style={{ background: theme.border, opacity: 0.6 }} />

                  {/* First move — prominent */}
                  <div className="flex items-baseline gap-1 min-w-0">
                    {numToken && (
                      <span
                        className="text-xs"
                        style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-mono)" }}
                      >
                        {numToken.text}
                      </span>
                    )}
                    {firstMoveToken && (
                      <span
                        className="font-bold rounded px-1"
                        style={{
                          fontFamily: "var(--f-mono)",
                          fontSize: "15px",
                          color: isSelected ? "#fff" : theme.color,
                          background: isSelected ? theme.color : `${theme.color}15`,
                          letterSpacing: "0.01em",
                          transition: "background 150ms ease, color 150ms ease",
                        }}
                      >
                        {firstMoveToken.text}
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Card bottom: continuation ── */}
                {restTokens.some((t) => t.kind === "move") && (
                  <div
                    className="flex flex-wrap gap-x-1 px-3 pb-2 pt-0"
                    style={{ borderTop: `1px solid ${theme.border}`, paddingTop: "5px" }}
                  >
                    {restTokens.map((token, j) => {
                      const isMoveActive = isSelected && token.moveIdx === pvStep;
                      if (token.kind === "number") {
                        return (
                          <span
                            key={j}
                            className="text-xs"
                            style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-mono)" }}
                          >
                            {token.text}
                          </span>
                        );
                      }
                      return (
                        <span
                          key={j}
                          className="text-xs rounded px-0.5 transition-colors"
                          style={{
                            fontFamily: "var(--f-mono)",
                            color: isMoveActive ? "#fff" : "var(--c-text-soft)",
                            fontWeight: isMoveActive ? 600 : 400,
                            background: isMoveActive ? theme.color : "transparent",
                          }}
                        >
                          {token.text}
                        </span>
                      );
                    })}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* ── Step controls ── */}
      {selectedLine >= 0 && (
        <div
          className="flex items-center gap-2 px-3 py-2.5 flex-wrap"
          style={{ borderTop: "1px solid var(--c-border)" }}
        >
          <button className="btn text-xs px-2 py-1" onClick={() => onPvStep(-1)} disabled={pvStep <= 0}>
            ← Prev
          </button>
          <button className="btn text-xs px-2 py-1" onClick={() => onPvStep(1)} disabled={pvStep >= activePvLength - 1}>
            Next →
          </button>
          {isPreviewing ? (
            <>
              <span
                className="text-xs tabular-nums"
                style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-mono)" }}
              >
                {pvStep + 1}/{activePvLength}
              </span>
              <button
                className="btn text-xs px-2 py-1 ml-auto"
                onClick={onExitPreview}
                style={{ borderColor: "var(--c-gm-bobby)", color: "var(--c-gm-bobby)" }}
              >
                ✕ Exit
              </button>
            </>
          ) : (
            <button
              className="btn text-xs px-2 py-1"
              onClick={() => onPvStep(1)}
              style={{
                borderColor: LINE_THEME[selectedLine]?.color,
                color: LINE_THEME[selectedLine]?.color,
              }}
            >
              ▶ Step through
            </button>
          )}
        </div>
      )}

      {/* ── Footer ── */}
      {selectedLine < 0 && (
        <div className="px-4 py-2" style={{ borderTop: "1px solid var(--c-border)" }}>
          <p className="text-xs" style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-mono)" }}>
            GM advice is grounded in these lines
          </p>
        </div>
      )}
    </div>
  );
};

export default EngineLines;
