import React, { useState, useEffect, useCallback, useRef } from "react";
import { Chess } from "chess.js";
import { OPENINGS, CATEGORIES, type Opening, type OpeningVariation } from "../data/openings";

interface OpeningsPanelProps {
  /** Called when the user enters an opening lesson so we can update the board */
  onPositionChange: (fen: string, moveIndex: number, opening: Opening) => void;
  /** Called when user exits the lesson */
  onExit: () => void;
  /** Current lesson step set externally (for keyboard nav sync) */
  currentStep: number;
  onStepChange: (step: number) => void;
  /** Active opening (null = browse mode) */
  activeOpening: Opening | null;
  onSelectOpening: (opening: Opening) => void;
}

function getInitialFen(): string {
  return new Chess().fen();
}

function getFenAtStep(moves: string[], step: number): string {
  const chess = new Chess();
  for (let i = 0; i <= step && i < moves.length; i++) {
    const m = moves[i];
    try {
      chess.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] ?? "q" });
    } catch { break; }
  }
  return chess.fen();
}

/** Convert UCI move list to human-readable SAN with move numbers */
function formatMoves(moves: string[]): { number: number; white: string; black: string | null }[] {
  const chess = new Chess();
  const result: { number: number; white: string; black: string | null }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    const m = moves[i];
    let white: { san: string } | null = null;
    try {
      white = chess.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] ?? "q" });
    } catch { break; }
    let black: string | null = null;
    if (i + 1 < moves.length) {
      const mb = moves[i + 1];
      try {
        const bMove = chess.move({ from: mb.slice(0, 2), to: mb.slice(2, 4), promotion: mb[4] ?? "q" });
        black = bMove?.san ?? null;
      } catch { /* no black move */ }
    }
    result.push({ number: i / 2 + 1, white: white?.san ?? m, black });
  }
  return result;
}

const OpeningsPanel: React.FC<OpeningsPanelProps> = ({
  onPositionChange,
  onExit,
  currentStep,
  onStepChange,
  activeOpening,
  onSelectOpening,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  // -1 = main line, 0+ = variation index
  const [activeVariationIndex, setActiveVariationIndex] = useState(-1);
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const annotationRef = useRef<HTMLDivElement>(null);

  // Derive the active move set and annotations from main line or selected variation
  const activeMoves: string[] = activeOpening
    ? activeVariationIndex >= 0
      ? (activeOpening.variations?.[activeVariationIndex]?.moves ?? activeOpening.moves)
      : activeOpening.moves
    : [];

  const activeAnnotations: string[] | undefined = activeOpening
    ? activeVariationIndex >= 0
      ? activeOpening.variations?.[activeVariationIndex]?.annotations
      : activeOpening.annotations
    : undefined;

  const activeVariationLabel: string =
    activeVariationIndex >= 0 && activeOpening?.variations
      ? (activeOpening.variations[activeVariationIndex]?.name ?? "Variation")
      : "Main Line";

  // When active opening or variation changes, broadcast position
  useEffect(() => {
    if (!activeOpening) return;
    const fen =
      currentStep < 0
        ? getInitialFen()
        : getFenAtStep(activeMoves, currentStep);
    onPositionChange(fen, currentStep, activeOpening);
  }, [activeOpening, activeVariationIndex, currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset step when switching variations
  const handleSelectVariation = useCallback(
    (idx: number) => {
      setActiveVariationIndex(idx);
      onStepChange(-1);
      if (animRef.current) { clearTimeout(animRef.current); setIsAnimating(false); }
    },
    [onStepChange]
  );

  const handleSelectOpening = useCallback(
    (opening: Opening) => {
      onSelectOpening(opening);
      onStepChange(-1);
      setActiveVariationIndex(-1);
    },
    [onSelectOpening, onStepChange]
  );

  const handlePrev = useCallback(() => {
    if (!activeOpening) return;
    onStepChange(Math.max(-1, currentStep - 1));
  }, [activeOpening, currentStep, onStepChange]);

  const handleNext = useCallback(() => {
    if (!activeOpening) return;
    onStepChange(Math.min(activeMoves.length - 1, currentStep + 1));
  }, [activeOpening, activeMoves.length, currentStep, onStepChange]);

  const handleAnimate = useCallback(() => {
    if (!activeOpening || isAnimating) return;
    setIsAnimating(true);
    onStepChange(-1);

    let step = -1;
    const tick = () => {
      step++;
      onStepChange(step);
      if (step < activeMoves.length - 1) {
        animRef.current = setTimeout(tick, 800);
      } else {
        setIsAnimating(false);
      }
    };
    animRef.current = setTimeout(tick, 600);
  }, [activeOpening, activeMoves.length, isAnimating, onStepChange]);

  const handleStopAnimate = useCallback(() => {
    if (animRef.current) clearTimeout(animRef.current);
    setIsAnimating(false);
  }, []);

  useEffect(() => {
    return () => {
      if (animRef.current) clearTimeout(animRef.current);
    };
  }, []);

  // Filter openings
  const filtered = OPENINGS.filter((o) => {
    const matchCategory = !selectedCategory || o.category === selectedCategory;
    const matchSearch =
      !search ||
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.eco.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  // Current annotation for active step
  const currentAnnotation: string | null =
    currentStep >= 0 && activeAnnotations && currentStep < activeAnnotations.length
      ? (activeAnnotations[currentStep] || null)
      : null;

  // ── Lesson view ─────────────────────────────────────────────────
  if (activeOpening) {
    const movePairs = formatMoves(activeMoves);
    const totalSteps = activeMoves.length;
    const progress = currentStep + 1;
    const hasVariations = activeOpening.variations && activeOpening.variations.length > 0;

    return (
      <div className="flex flex-col h-full gap-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <button
            onClick={onExit}
            className="text-sm flex items-center gap-1 transition-colors shrink-0"
            style={{ color: "var(--c-text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--c-text)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--c-text-muted)")}
          >
            ← Back
          </button>
          <div className="text-center flex-1 min-w-0">
            <div
              className="text-xs mb-0.5 truncate"
              style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-mono)" }}
            >
              {activeOpening.eco}
            </div>
            <div
              className="font-semibold truncate"
              style={{ color: "var(--c-text)", fontFamily: "var(--f-serif)", fontSize: "0.95rem" }}
            >
              {activeOpening.name}
            </div>
          </div>
          <div
            className="text-xs tabular-nums shrink-0"
            style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-mono)" }}
          >
            {Math.max(0, progress)}/{totalSteps}
          </div>
        </div>

        {/* Variation tab bar */}
        {hasVariations && (
          <div
            className="flex gap-1 overflow-x-auto pb-0.5 shrink-0"
            style={{ scrollbarWidth: "none" }}
          >
            {/* Main line tab */}
            <button
              onClick={() => handleSelectVariation(-1)}
              className="text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-all duration-100 shrink-0"
              style={
                activeVariationIndex === -1
                  ? {
                      background: "var(--c-gold-dim)",
                      border: "1px solid var(--c-gold)",
                      color: "var(--c-gold-bright)",
                      fontFamily: "var(--f-sans)",
                    }
                  : {
                      background: "var(--c-raised)",
                      border: "1px solid var(--c-border-mid)",
                      color: "var(--c-text-muted)",
                      fontFamily: "var(--f-sans)",
                    }
              }
            >
              Main Line
            </button>
            {activeOpening.variations!.map((v, i) => (
              <button
                key={i}
                onClick={() => handleSelectVariation(i)}
                className="text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-all duration-100 shrink-0"
                style={
                  activeVariationIndex === i
                    ? {
                        background: "var(--c-gold-dim)",
                        border: "1px solid var(--c-gold)",
                        color: "var(--c-gold-bright)",
                        fontFamily: "var(--f-sans)",
                      }
                    : {
                        background: "var(--c-raised)",
                        border: "1px solid var(--c-border-mid)",
                        color: "var(--c-text-muted)",
                        fontFamily: "var(--f-sans)",
                      }
                }
              >
                {v.name}
              </button>
            ))}
          </div>
        )}

        {/* Variation/main-line description */}
        <p
          className="text-xs leading-relaxed shrink-0"
          style={{ color: "var(--c-text-soft)" }}
        >
          {activeVariationIndex >= 0 && activeOpening.variations
            ? activeOpening.variations[activeVariationIndex]?.description
            : activeOpening.description}
        </p>

        {/* Move list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="grid gap-0.5">
            {movePairs.map((pair, i) => {
              const whiteIdx = i * 2;
              const blackIdx = i * 2 + 1;
              return (
                <div
                  key={i}
                  className="flex items-center gap-1 text-sm"
                  style={{ fontFamily: "var(--f-mono)" }}
                >
                  <span
                    className="w-6 text-right shrink-0 text-xs"
                    style={{ color: "var(--c-text-muted)" }}
                  >
                    {pair.number}.
                  </span>
                  <button
                    onClick={() => onStepChange(whiteIdx)}
                    className="px-2 py-0.5 rounded transition-all duration-100"
                    style={
                      currentStep === whiteIdx
                        ? {
                            background: "var(--c-gold-dim)",
                            color: "var(--c-gold-bright)",
                            border: "1px solid var(--c-gold)",
                          }
                        : { color: "var(--c-text-soft)", border: "1px solid transparent" }
                    }
                  >
                    {pair.white}
                  </button>
                  {pair.black !== null && (
                    <button
                      onClick={() => onStepChange(blackIdx)}
                      className="px-2 py-0.5 rounded transition-all duration-100"
                      style={
                        currentStep === blackIdx
                          ? {
                              background: "var(--c-gold-dim)",
                              color: "var(--c-gold-bright)",
                              border: "1px solid var(--c-gold)",
                            }
                          : { color: "var(--c-text-soft)", border: "1px solid transparent" }
                      }
                    >
                      {pair.black}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Annotation panel */}
        <div
          ref={annotationRef}
          className="shrink-0 rounded-lg px-3 py-2.5 transition-all duration-200"
          style={{
            minHeight: "3.5rem",
            background: currentAnnotation ? "var(--c-raised)" : "transparent",
            border: `1px solid ${currentAnnotation ? "var(--c-border-bright)" : "transparent"}`,
          }}
        >
          {currentAnnotation ? (
            <div className="flex gap-2 items-start">
              <span
                className="text-xs shrink-0 mt-0.5 font-semibold"
                style={{ color: "var(--c-gold)", fontFamily: "var(--f-mono)" }}
              >
                ♟
              </span>
              <p
                className="text-xs leading-relaxed"
                style={{ color: "var(--c-text-soft)" }}
              >
                {currentAnnotation}
              </p>
            </div>
          ) : currentStep === -1 ? (
            <p className="text-xs" style={{ color: "var(--c-text-muted)" }}>
              Step through the moves to see coaching notes.
            </p>
          ) : (
            <p className="text-xs" style={{ color: "var(--c-text-muted)" }}>
              <span style={{ fontFamily: "var(--f-mono)", color: "var(--c-gold-dim)", marginRight: "0.375rem" }}>—</span>
              No annotation for this move.
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-2 flex-wrap shrink-0">
          <button className="btn text-xs" onClick={handlePrev} disabled={currentStep < 0}>
            ← Prev
          </button>
          <button className="btn text-xs" onClick={handleNext} disabled={currentStep >= totalSteps - 1}>
            Next →
          </button>
          {isAnimating ? (
            <button
              className="btn text-xs"
              onClick={handleStopAnimate}
              style={{ borderColor: "var(--c-gm-bobby)", color: "var(--c-gm-bobby)" }}
            >
              ■ Stop
            </button>
          ) : (
            <button
              className="btn text-xs"
              onClick={handleAnimate}
              style={{ borderColor: "var(--c-line1)", color: "var(--c-line1)" }}
            >
              ▶ Animate
            </button>
          )}
          <span
            className="ml-auto text-xs self-center"
            style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-mono)" }}
          >
            {activeVariationLabel}
          </span>
        </div>

        <p
          className="text-xs shrink-0"
          style={{ color: "var(--c-text-muted)" }}
        >
          Ask your GM about any move in the chat →
        </p>
      </div>
    );
  }

  // ── Browse view ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <div className="mb-3">
        <h2
          className="font-semibold mb-1"
          style={{ color: "var(--c-text)", fontFamily: "var(--f-serif)", fontSize: "1.05rem" }}
        >
          Opening Lessons
        </h2>
        <p className="text-xs" style={{ color: "var(--c-text-muted)" }}>
          Select an opening to study it move by move.
        </p>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search openings…"
        className="w-full text-sm px-3 py-2 rounded-lg mb-2 focus:outline-none transition-colors"
        style={{
          background: "var(--c-raised)",
          border: "1px solid var(--c-border-bright)",
          color: "var(--c-text)",
          fontFamily: "var(--f-sans)",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--c-gold)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--c-border-bright)")}
      />

      {/* Category filters */}
      <div className="flex flex-wrap gap-1 mb-3">
        <button
          onClick={() => setSelectedCategory(null)}
          className="text-xs px-2.5 py-1 rounded-full transition-all duration-100"
          style={
            !selectedCategory
              ? { background: "var(--c-gold-dim)", border: "1px solid var(--c-gold)", color: "var(--c-gold-bright)" }
              : { background: "transparent", border: "1px solid var(--c-border-mid)", color: "var(--c-text-muted)" }
          }
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            className="text-xs px-2.5 py-1 rounded-full transition-all duration-100"
            style={
              selectedCategory === cat
                ? { background: "var(--c-gold-dim)", border: "1px solid var(--c-gold)", color: "var(--c-gold-bright)" }
                : { background: "transparent", border: "1px solid var(--c-border-mid)", color: "var(--c-text-muted)" }
            }
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Opening list */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-1">
        {filtered.map((opening) => {
          const varCount = opening.variations?.length ?? 0;
          return (
            <button
              key={`${opening.eco}-${opening.name}`}
              onClick={() => handleSelectOpening(opening)}
              className="w-full text-left px-3 py-2.5 rounded-lg transition-all duration-100"
              style={{
                background: "var(--c-raised)",
                border: "1px solid var(--c-border)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--c-border-bright)";
                (e.currentTarget as HTMLButtonElement).style.background = "var(--c-hover)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--c-border)";
                (e.currentTarget as HTMLButtonElement).style.background = "var(--c-raised)";
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="font-medium text-sm"
                  style={{ color: "var(--c-text)" }}
                >
                  {opening.name}
                </span>
                <span
                  className="text-xs shrink-0"
                  style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-mono)" }}
                >
                  {opening.eco}
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5 gap-2">
                <div className="text-xs" style={{ color: "var(--c-text-muted)" }}>
                  {opening.category}
                </div>
                {varCount > 0 && (
                  <div
                    className="text-xs shrink-0"
                    style={{ color: "var(--c-gold)", fontFamily: "var(--f-mono)" }}
                  >
                    {varCount} var{varCount !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-center mt-6" style={{ color: "var(--c-text-muted)" }}>
            No openings found
          </p>
        )}
      </div>
    </div>
  );
};

export default OpeningsPanel;
