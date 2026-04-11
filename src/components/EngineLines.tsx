import React, { useMemo } from "react";
import { Chess } from "chess.js";
import type { EngineLineResult } from "../hooks/useStockfish";

interface EngineLinesProps {
  topLines: EngineLineResult[];
  currentFen: string;
  thinking: boolean;
  /** Index of selected line (0-based), -1 = none */
  selectedLine: number;
  /** Current preview step within selected line, -1 = not stepping */
  pvStep: number;
  onSelectLine: (i: number) => void;
  onPvStep: (dir: 1 | -1) => void;
  onExitPreview: () => void;
}

const LINE_THEME = [
  {
    color: "var(--c-line1)",
    bg: "var(--c-line1-bg)",
    border: "var(--c-line1-border)",
    label: "Best",
  },
  {
    color: "var(--c-line2)",
    bg: "var(--c-line2-bg)",
    border: "var(--c-line2-border)",
    label: "Alt",
  },
  {
    color: "var(--c-line3)",
    bg: "var(--c-line3-bg)",
    border: "var(--c-line3-border)",
    label: "Alt",
  },
];

function formatEval(score: number | null, mate: number | null): string {
  if (mate !== null) return mate > 0 ? `M${mate}` : `M${Math.abs(mate)}`;
  if (score === null) return "—";
  if (score >= 9999) return "M";
  if (score <= -9999) return "M";
  const abs = Math.abs(score / 100).toFixed(2);
  return score > 0 ? `+${abs}` : score < 0 ? `-${abs}` : "0.00";
}

interface LineToken {
  text: string;
  kind: "number" | "move";
  moveIdx: number; // which pv index this move corresponds to (-1 for number tokens)
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

      const result = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4] ?? "q",
      });
      if (!result) return;

      tokens.push({ text: result.san, kind: "move", moveIdx: i });
    } catch {
      // Stop on illegal move
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
      tokens: buildTokens(currentFen, line.pv),
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
                className={`thinking-bar inline-block w-0.5 rounded-full`}
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

      {/* ── Lines ── */}
      <div className="p-2 space-y-1">
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

            return (
              <button
                key={i}
                onClick={() => onSelectLine(isSelected ? -1 : i)}
                className="w-full text-left px-3 py-2 rounded-lg transition-all duration-150 group"
                style={{
                  background: isSelected ? theme.bg : "transparent",
                  border: `1px solid ${isSelected ? theme.border : "transparent"}`,
                }}
              >
                <div className="flex items-start gap-3 min-w-0">
                  {/* Eval badge */}
                  <span
                    className="text-xs font-semibold tabular-nums shrink-0 mt-0.5 w-11 text-right"
                    style={{ color: theme.color, fontFamily: "var(--f-mono)" }}
                  >
                    {line.evalStr}
                  </span>

                  {/* Move tokens */}
                  <span
                    className="text-xs leading-relaxed flex flex-wrap gap-x-1 min-w-0"
                    style={{ fontFamily: "var(--f-mono)" }}
                  >
                    {line.tokens.map((token, j) => {
                      const isMoveActive = isSelected && token.moveIdx === pvStep;
                      const isFirstMove = token.moveIdx === 0;

                      if (token.kind === "number") {
                        return (
                          <span key={j} style={{ color: "var(--c-text-muted)" }}>
                            {token.text}
                          </span>
                        );
                      }

                      return (
                        <span
                          key={j}
                          className="rounded px-0.5 transition-colors"
                          style={{
                            color: isMoveActive
                              ? "#fff"
                              : isFirstMove
                              ? "var(--c-text)"
                              : "var(--c-text-soft)",
                            fontWeight: isFirstMove ? 600 : 400,
                            background: isMoveActive ? theme.color : "transparent",
                          }}
                        >
                          {token.text}
                        </span>
                      );
                    })}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* ── Step controls (visible when a line is selected) ── */}
      {selectedLine >= 0 && (
        <div
          className="flex items-center gap-2 px-3 py-2.5 flex-wrap"
          style={{ borderTop: "1px solid var(--c-border)" }}
        >
          <button
            className="btn text-xs px-2 py-1"
            onClick={() => onPvStep(-1)}
            disabled={pvStep <= 0}
          >
            ← Prev
          </button>
          <button
            className="btn text-xs px-2 py-1"
            onClick={() => onPvStep(1)}
            disabled={pvStep >= activePvLength - 1}
          >
            Next →
          </button>
          {isPreviewing && (
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
          )}
          {!isPreviewing && (
            <button
              className="btn text-xs px-2 py-1"
              onClick={() => onPvStep(1)}
              style={{ borderColor: LINE_THEME[selectedLine]?.color, color: LINE_THEME[selectedLine]?.color }}
            >
              ▶ Step through
            </button>
          )}
        </div>
      )}

      {/* ── Footer ── */}
      {!selectedLine && selectedLine !== 0 && (
        <div
          className="px-4 py-2"
          style={{ borderTop: "1px solid var(--c-border)" }}
        >
          <p
            className="text-xs"
            style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-mono)" }}
          >
            GM advice is grounded in these lines
          </p>
        </div>
      )}
    </div>
  );
};

export default EngineLines;
