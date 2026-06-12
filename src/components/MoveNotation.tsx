import React, { useEffect, useRef } from "react";

interface MoveNotationProps {
  sanMoves: string[];
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

  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [currentIndex]);

  if (sanMoves.length === 0) {
    return (
      <div
        className="flex items-center justify-center py-2 text-xs"
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
      className="flex flex-wrap gap-x-0.5 gap-y-0.5 overflow-y-auto"
      style={{ maxHeight: "5rem", scrollbarWidth: "none" }}
    >
      {/* Start position button */}
      <button
        onClick={() => onNavigate(0)}
        className="text-xs px-1.5 py-0.5 rounded transition-all duration-100"
        style={
          currentIndex === 0
            ? {
                background: "var(--c-gold-dim)",
                color: "var(--c-gold-bright)",
                border: "1px solid var(--c-gold)",
                fontFamily: "var(--f-mono)",
              }
            : {
                color: "var(--c-text-muted)",
                border: "1px solid transparent",
                fontFamily: "var(--f-mono)",
              }
        }
      >
        ⊙
      </button>

      {pairs.map((pair) => (
        <React.Fragment key={pair.number}>
          {/* Move number */}
          <span
            className="text-xs self-center tabular-nums select-none px-0.5"
            style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-mono)" }}
          >
            {pair.number}.
          </span>

          {/* White move */}
          {pair.white && (
            <MoveButton
              san={pair.white.san}
              index={pair.white.index}
              currentIndex={currentIndex}
              onNavigate={onNavigate}
              activeRef={currentIndex === pair.white.index ? activeRef : undefined}
            />
          )}

          {/* Black move */}
          {pair.black && (
            <MoveButton
              san={pair.black.san}
              index={pair.black.index}
              currentIndex={currentIndex}
              onNavigate={onNavigate}
              activeRef={currentIndex === pair.black.index ? activeRef : undefined}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

interface MoveButtonProps {
  san: string;
  index: number;
  currentIndex: number;
  onNavigate: (index: number) => void;
  activeRef?: React.Ref<HTMLButtonElement>;
}

const MoveButton: React.FC<MoveButtonProps> = ({ san, index, currentIndex, onNavigate, activeRef }) => {
  const isActive = currentIndex === index;

  return (
    <button
      ref={activeRef}
      onClick={() => onNavigate(index)}
      className="text-xs px-1.5 py-0.5 rounded"
      style={{
        background: isActive ? "var(--c-gold-dim)" : "transparent",
        color: isActive ? "var(--c-gold-bright)" : "var(--c-text-soft)",
        border: `1px solid ${isActive ? "var(--c-gold)" : "transparent"}`,
        fontFamily: "var(--f-mono)",
        transition: "background 100ms ease, color 100ms ease, border-color 100ms ease",
        fontWeight: isActive ? 600 : 400,
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLButtonElement).style.background = "var(--c-hover)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--c-text)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--c-text-soft)";
        }
      }}
    >
      {san}
    </button>
  );
};

export default MoveNotation;
