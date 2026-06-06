import React, { useEffect, useRef } from "react";

interface MoveNotationProps {
  /** SAN moves from game start. sanMoves[i] transitions history[i] → history[i+1]. */
  sanMoves: string[];
  /** Current history index (0 = start position, 1 = after move 1, etc.) */
  currentIndex: number;
  onNavigate: (index: number) => void;
}

interface MovePair {
  number: number;
  white: { san: string; index: number } | null;
  black: { san: string; index: number } | null;
}

function buildPairs(sanMoves: string[]): MovePair[] {
  const pairs: MovePair[] = [];
  for (let i = 0; i < sanMoves.length; i += 2) {
    pairs.push({
      number: Math.floor(i / 2) + 1,
      white: { san: sanMoves[i], index: i + 1 },
      black: sanMoves[i + 1] !== undefined ? { san: sanMoves[i + 1], index: i + 2 } : null,
    });
  }
  return pairs;
}

const MoveNotation: React.FC<MoveNotationProps> = ({ sanMoves, currentIndex, onNavigate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll active move into view
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [currentIndex]);

  if (sanMoves.length === 0) {
    return (
      <div
        className="flex items-center justify-center py-3 text-xs"
        style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-mono)" }}
      >
        No moves yet
      </div>
    );
  }

  const pairs = buildPairs(sanMoves);

  return (
    <div
      ref={containerRef}
      className="flex flex-wrap gap-x-1 gap-y-0.5 overflow-y-auto"
      style={{ maxHeight: "5rem", scrollbarWidth: "none" }}
    >
      {/* Start position button */}
      <button
        onClick={() => onNavigate(0)}
        className="text-xs px-1.5 py-0.5 rounded transition-all duration-100"
        style={
          currentIndex === 0
            ? { background: "var(--c-gold-dim)", color: "var(--c-gold-bright)", border: "1px solid var(--c-gold)" }
            : { color: "var(--c-text-muted)", border: "1px solid transparent" }
        }
      >
        ⊙
      </button>

      {pairs.map((pair) => (
        <React.Fragment key={pair.number}>
          {/* Move number */}
          <span
            className="text-xs self-center tabular-nums select-none"
            style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-mono)" }}
          >
            {pair.number}.
          </span>

          {/* White move */}
          {pair.white && (
            <button
              ref={currentIndex === pair.white.index ? activeRef : undefined}
              onClick={() => onNavigate(pair.white!.index)}
              className="text-xs px-1.5 py-0.5 rounded transition-all duration-100"
              style={
                currentIndex === pair.white.index
                  ? { background: "var(--c-gold-dim)", color: "var(--c-gold-bright)", border: "1px solid var(--c-gold)", fontFamily: "var(--f-mono)" }
                  : { color: "var(--c-text-soft)", border: "1px solid transparent", fontFamily: "var(--f-mono)" }
              }
            >
              {pair.white.san}
            </button>
          )}

          {/* Black move */}
          {pair.black && (
            <button
              ref={currentIndex === pair.black.index ? activeRef : undefined}
              onClick={() => onNavigate(pair.black!.index)}
              className="text-xs px-1.5 py-0.5 rounded transition-all duration-100"
              style={
                currentIndex === pair.black.index
                  ? { background: "var(--c-gold-dim)", color: "var(--c-gold-bright)", border: "1px solid var(--c-gold)", fontFamily: "var(--f-mono)" }
                  : { color: "var(--c-text-soft)", border: "1px solid transparent", fontFamily: "var(--f-mono)" }
              }
            >
              {pair.black.san}
            </button>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default MoveNotation;
