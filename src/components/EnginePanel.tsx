import { useMemo } from "react";
import type { EngineLine } from "../engine/uci";
import type { EngineStatus } from "../hooks/useStockfish";
import { evalLabel, formatEvalValue } from "../lib/evaluation";
import type { GameOutcome } from "../lib/outcome";
import { pvTokens } from "../lib/pv";
import { ArrowLeft, ArrowRight, Close } from "./icons";

interface EnginePanelProps {
  /** The position the lines belong to. */
  fen: string;
  lines: EngineLine[];
  thinking: boolean;
  status: EngineStatus;
  /** Set when the game is over: there is nothing to analyse. */
  outcome: GameOutcome | null;
  /** Which line is being previewed on the board (-1 = none) and how far through it. */
  selectedLine: number;
  step: number;
  length: number;
  onSelect: (index: number) => void;
  onStep: (direction: 1 | -1) => void;
  onExit: () => void;
}

function describeSource(status: EngineStatus, depth: number | undefined): string {
  if (status === "fallback") return "Lichess cloud analysis";
  if (status === "starting") return "Starting Stockfish…";
  return depth ? `Stockfish 16 · depth ${depth}` : "Stockfish 16";
}

/** The engine's top lines. Select one to step through it on the board. */
export default function EnginePanel({ fen, lines, thinking, status, outcome, selectedLine, step, length, onSelect, onStep, onExit }: EnginePanelProps) {
  const rows = useMemo(
    () =>
      lines.map((line) => {
        const tokens = pvTokens(fen, line.pv, 8);
        const firstMove = tokens.find((token) => token.kind === "move");
        const numberBefore = tokens[0]?.kind === "number" ? tokens[0] : null;
        const rest = tokens.slice(firstMove ? tokens.indexOf(firstMove) + 1 : 0);
        return { line, firstMove, numberBefore, rest };
      }),
    [fen, lines],
  );

  const depth = lines.find((line) => line.depth)?.depth;
  const previewing = selectedLine >= 0;

  return (
    <section aria-label="Engine analysis" className="engine">
      <div className="panel-head">
        <h2 className="type-label">Engine</h2>
        <p className="type-small muted engine-source">
          {describeSource(status, depth)}
          {thinking && !outcome && (
            <span className="dots" role="status" aria-label="Analysing">
              <span />
              <span />
              <span />
            </span>
          )}
        </p>
      </div>

      <ol className="engine-lines">
        {rows.length === 0 && thinking && !outcome && [0, 1, 2].map((i) => <li key={i} className="skeleton engine-skeleton" aria-hidden="true" />)}

        {rows.length === 0 && !thinking && (
          <li className="type-small muted engine-empty">
            {outcome ? "The game is over, so there is nothing left to analyse." : status === "fallback" ? "No cached analysis for this position." : "No analysis for this position."}
          </li>
        )}

        {rows.map(({ line, firstMove, numberBefore, rest }, i) => {
          const selected = selectedLine === i;
          return (
            <li key={i}>
              <button type="button" className="engine-line" aria-pressed={selected} onClick={() => onSelect(i)}>
                <span className="engine-rank type-label muted num">{i + 1}</span>
                <span className="engine-score">
                  <span className="type-title num">{formatEvalValue(line.score, line.mate)}</span>
                  <span className="type-small muted">{evalLabel(line.score, line.mate)}</span>
                </span>
                <span className="engine-moves">
                  <span className="engine-first">
                    {numberBefore && <span className="type-small num muted">{numberBefore.text}</span>}
                    {firstMove && (
                      <span className="engine-san type-ui num" data-active={selected && step === 0 ? "" : undefined}>
                        {firstMove.text}
                      </span>
                    )}
                  </span>
                  {rest.some((token) => token.kind === "move") && (
                    <span className="engine-rest type-small num">
                      {rest.map((token, j) =>
                        token.kind === "number" ? (
                          <span key={j} className="muted">
                            {token.text}
                          </span>
                        ) : (
                          <span key={j} className="engine-step" data-active={selected && token.moveIndex === step ? "" : undefined}>
                            {token.text}
                          </span>
                        ),
                      )}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {previewing && (
        <div className="engine-steps">
          <button type="button" className="btn btn-icon" onClick={() => onStep(-1)} disabled={step <= 0} aria-label="Previous move in line">
            <ArrowLeft size={18} />
          </button>
          <button type="button" className="btn btn-icon" onClick={() => onStep(1)} disabled={step >= length - 1} aria-label="Next move in line">
            <ArrowRight size={18} />
          </button>
          <span className="type-small num muted">
            {step + 1}/{length}
          </span>
          <button type="button" className="btn push" onClick={onExit}>
            <Close size={16} /> Back to game
          </button>
        </div>
      )}
    </section>
  );
}
