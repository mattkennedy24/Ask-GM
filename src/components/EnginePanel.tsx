import { useMemo } from "react";
import type { EngineLine } from "../engine/uci";
import type { EngineStatus } from "../hooks/useStockfish";
import { evalLabel, formatEvalValue } from "../lib/evaluation";
import { pvTokens } from "../lib/pv";
import { ArrowLeft, ArrowRight, Close } from "./icons";

interface EnginePanelProps {
  /** The position the lines belong to. */
  fen: string;
  lines: EngineLine[];
  thinking: boolean;
  status: EngineStatus;
  /** Which line is being previewed on the board (-1 = none) and how far through it. */
  selectedLine: number;
  step: number;
  length: number;
  onSelect: (index: number) => void;
  onStep: (direction: 1 | -1) => void;
  onExit: () => void;
}

const THEMES = [
  { color: "var(--c-line1)", bg: "var(--c-line1-bg)", border: "var(--c-line1-border)" },
  { color: "var(--c-line2)", bg: "var(--c-line2-bg)", border: "var(--c-line2-border)" },
  { color: "var(--c-line3)", bg: "var(--c-line3-bg)", border: "var(--c-line3-border)" },
];

function describeSource(status: EngineStatus, depth: number | undefined): string {
  if (status === "fallback") return "Lichess cloud analysis";
  if (status === "starting") return "Starting Stockfish…";
  return depth ? `Stockfish 16 · depth ${depth}` : "Stockfish 16";
}

/** The engine's top lines as move cards. Select one to step through it on the board. */
export default function EnginePanel({ fen, lines, thinking, status, selectedLine, step, length, onSelect, onStep, onExit }: EnginePanelProps) {
  const cards = useMemo(
    () =>
      lines.map((line) => {
        const tokens = pvTokens(fen, line.pv, 8);
        const firstMove = tokens.find((t) => t.kind === "move");
        const numberBefore = tokens[0]?.kind === "number" ? tokens[0] : null;
        const rest = tokens.slice(firstMove ? tokens.indexOf(firstMove) + 1 : 0);
        return { line, firstMove, numberBefore, rest };
      }),
    [fen, lines],
  );

  const depth = lines.find((l) => l.depth)?.depth;
  const previewing = selectedLine >= 0;

  return (
    <section aria-label="Engine analysis" className="panel overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2" style={{ borderBottom: "1px solid var(--c-border)" }}>
        <h2 className="text-xs font-semibold uppercase" style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-mono)", letterSpacing: "0.12em" }}>
          Engine
        </h2>
        <span className="flex items-center gap-2 text-xs" style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-mono)" }}>
          {describeSource(status, depth)}
          {thinking && (
            <span className="flex h-3 items-end gap-0.5" role="status" aria-label="Analysing">
              {[0, 1, 2].map((i) => (
                <span key={i} className="thinking-bar inline-block w-0.5 rounded-full" style={{ height: i === 1 ? 10 : 6, background: "var(--c-text-muted)" }} />
              ))}
            </span>
          )}
        </span>
      </div>

      <div className="flex flex-col gap-1.5 p-2">
        {cards.length === 0 && thinking && [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: "3.25rem" }} aria-hidden="true" />)}

        {cards.length === 0 && !thinking && (
          <p className="py-4 text-center text-xs" style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-mono)" }}>
            {status === "fallback" ? "No cached analysis for this position." : "No analysis for this position."}
          </p>
        )}

        {cards.map(({ line, firstMove, numberBefore, rest }, i) => {
          const theme = THEMES[i] ?? THEMES[2];
          const selected = selectedLine === i;
          return (
            <button
              key={i}
              type="button"
              className="engine-card overflow-hidden"
              aria-pressed={selected}
              onClick={() => onSelect(i)}
              style={{ ["--card-bg" as string]: theme.bg, ["--card-border" as string]: theme.border }}
            >
              <span className="flex items-center gap-3 px-3 py-2">
                <span className="flex shrink-0 flex-col" style={{ minWidth: "5.5rem" }}>
                  <span className="text-sm font-semibold tabular-nums leading-tight" style={{ color: theme.color, fontFamily: "var(--f-mono)" }}>
                    {formatEvalValue(line.score, line.mate)}
                  </span>
                  <span className="text-xs leading-tight" style={{ color: "var(--c-text-muted)" }}>
                    {evalLabel(line.score, line.mate)}
                  </span>
                </span>
                <span className="self-stretch" style={{ width: 1, background: theme.border }} aria-hidden="true" />
                <span className="flex items-baseline gap-1.5">
                  {numberBefore && (
                    <span className="text-xs" style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-mono)" }}>
                      {numberBefore.text}
                    </span>
                  )}
                  {firstMove && (
                    <span
                      className="rounded px-1.5 text-base font-bold"
                      style={{
                        fontFamily: "var(--f-mono)",
                        color: selected && step === 0 ? "var(--c-bg)" : theme.color,
                        background: selected && step === 0 ? theme.color : `color-mix(in srgb, ${theme.color} 12%, transparent)`,
                      }}
                    >
                      {firstMove.text}
                    </span>
                  )}
                </span>
              </span>

              {rest.some((t) => t.kind === "move") && (
                <span className="flex flex-wrap gap-x-1 px-3 pb-2 pt-1.5" style={{ borderTop: `1px solid ${theme.border}` }}>
                  {rest.map((token, j) =>
                    token.kind === "number" ? (
                      <span key={j} className="text-xs" style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-mono)" }}>
                        {token.text}
                      </span>
                    ) : (
                      <span
                        key={j}
                        className="rounded px-0.5 text-xs"
                        style={{
                          fontFamily: "var(--f-mono)",
                          color: selected && token.moveIndex === step ? "var(--c-bg)" : "var(--c-text-soft)",
                          background: selected && token.moveIndex === step ? theme.color : "transparent",
                          fontWeight: selected && token.moveIndex === step ? 700 : 400,
                        }}
                      >
                        {token.text}
                      </span>
                    ),
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {previewing && (
        <div className="flex items-center gap-2 px-2 pb-2">
          <button type="button" className="btn btn-icon" onClick={() => onStep(-1)} disabled={step <= 0} aria-label="Previous move in line">
            <ArrowLeft size={16} />
          </button>
          <button type="button" className="btn btn-icon" onClick={() => onStep(1)} disabled={step >= length - 1} aria-label="Next move in line">
            <ArrowRight size={16} />
          </button>
          <span className="text-xs tabular-nums" style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-mono)" }}>
            {step + 1}/{length}
          </span>
          <button type="button" className="btn ml-auto" onClick={onExit}>
            <Close size={14} /> Back to game
          </button>
        </div>
      )}
    </section>
  );
}
