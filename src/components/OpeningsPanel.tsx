import React, { useState, useEffect, useCallback, useRef } from "react";
import { Chess } from "chess.js";
import { OPENINGS, CATEGORIES, type Opening } from "../data/openings";

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
    chess.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] ?? "q" });
  }
  return chess.fen();
}

/** Convert UCI move list to human-readable SAN with move numbers */
function formatMoves(moves: string[]): { number: number; white: string; black: string | null }[] {
  const chess = new Chess();
  const result: { number: number; white: string; black: string | null }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    const m = moves[i];
    const white = chess.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] ?? "q" });
    let black: string | null = null;
    if (i + 1 < moves.length) {
      const mb = moves[i + 1];
      const bMove = chess.move({ from: mb.slice(0, 2), to: mb.slice(2, 4), promotion: mb[4] ?? "q" });
      black = bMove?.san ?? null;
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
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When active opening changes, broadcast position
  useEffect(() => {
    if (!activeOpening) return;
    const fen =
      currentStep < 0
        ? getInitialFen()
        : getFenAtStep(activeOpening.moves, currentStep);
    onPositionChange(fen, currentStep, activeOpening);
  }, [activeOpening, currentStep, onPositionChange]);

  const handleSelectOpening = useCallback(
    (opening: Opening) => {
      onSelectOpening(opening);
      onStepChange(-1);
    },
    [onSelectOpening, onStepChange]
  );

  const handlePrev = useCallback(() => {
    if (!activeOpening) return;
    onStepChange(Math.max(-1, currentStep - 1));
  }, [activeOpening, currentStep, onStepChange]);

  const handleNext = useCallback(() => {
    if (!activeOpening) return;
    onStepChange(Math.min(activeOpening.moves.length - 1, currentStep + 1));
  }, [activeOpening, currentStep, onStepChange]);

  const handleAnimate = useCallback(() => {
    if (!activeOpening || isAnimating) return;
    setIsAnimating(true);
    onStepChange(-1);

    let step = -1;
    const tick = () => {
      step++;
      onStepChange(step);
      if (step < activeOpening.moves.length - 1) {
        animRef.current = setTimeout(tick, 800);
      } else {
        setIsAnimating(false);
      }
    };
    animRef.current = setTimeout(tick, 600);
  }, [activeOpening, isAnimating, onStepChange]);

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

  // ── Lesson view ─────────────────────────────────────────────────
  if (activeOpening) {
    const movePairs = formatMoves(activeOpening.moves);
    const totalSteps = activeOpening.moves.length;
    const progress = currentStep + 1; // -1 = start = 0 moves shown

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 gap-2">
          <button
            onClick={onExit}
            className="text-zinc-400 hover:text-white text-sm flex items-center gap-1"
          >
            ← Back
          </button>
          <div className="text-center flex-1">
            <div className="text-xs text-zinc-500 font-mono">{activeOpening.eco}</div>
            <div className="font-semibold text-sm text-white">{activeOpening.name}</div>
          </div>
          <div className="text-xs text-zinc-500 tabular-nums">
            {Math.max(0, progress)}/{totalSteps}
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-zinc-400 leading-relaxed mb-3">{activeOpening.description}</p>

        {/* Move list */}
        <div className="flex-1 overflow-y-auto min-h-0 mb-3">
          <div className="grid gap-0.5">
            {movePairs.map((pair, i) => {
              const whiteIdx = i * 2;
              const blackIdx = i * 2 + 1;
              return (
                <div key={i} className="flex items-center gap-1 text-sm font-mono">
                  <span className="text-zinc-600 w-6 text-right shrink-0">{pair.number}.</span>
                  <button
                    onClick={() => onStepChange(whiteIdx)}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      currentStep === whiteIdx
                        ? "bg-blue-600 text-white"
                        : "text-zinc-300 hover:bg-zinc-700"
                    }`}
                  >
                    {pair.white}
                  </button>
                  {pair.black !== null && (
                    <button
                      onClick={() => onStepChange(blackIdx)}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        currentStep === blackIdx
                          ? "bg-blue-600 text-white"
                          : "text-zinc-300 hover:bg-zinc-700"
                      }`}
                    >
                      {pair.black}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2 flex-wrap">
          <button className="btn text-xs" onClick={handlePrev} disabled={currentStep < 0}>
            ← Prev
          </button>
          <button
            className="btn text-xs"
            onClick={handleNext}
            disabled={currentStep >= totalSteps - 1}
          >
            Next →
          </button>
          {isAnimating ? (
            <button className="btn text-xs bg-red-700 hover:bg-red-600" onClick={handleStopAnimate}>
              Stop
            </button>
          ) : (
            <button
              className="btn text-xs bg-green-700 hover:bg-green-600"
              onClick={handleAnimate}
              disabled={isAnimating}
            >
              ▶ Animate
            </button>
          )}
        </div>
        <p className="text-xs text-zinc-500 mt-2">
          Tip: Use the chat to ask your GM about this opening!
        </p>
      </div>
    );
  }

  // ── Browse view ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <div className="mb-3">
        <h2 className="font-bold text-white text-base mb-1">Opening Lessons</h2>
        <p className="text-xs text-zinc-400">
          Select an opening to study it move by move and ask your GM.
        </p>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search openings..."
        className="w-full bg-zinc-900 text-white text-sm p-2 rounded-lg border border-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500 mb-2"
      />

      {/* Category filters */}
      <div className="flex flex-wrap gap-1 mb-3">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`text-xs px-2 py-1 rounded-full border transition-colors ${
            !selectedCategory
              ? "bg-blue-600 border-blue-600 text-white"
              : "border-zinc-600 text-zinc-400 hover:border-zinc-400"
          }`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            className={`text-xs px-2 py-1 rounded-full border transition-colors ${
              selectedCategory === cat
                ? "bg-blue-600 border-blue-600 text-white"
                : "border-zinc-600 text-zinc-400 hover:border-zinc-400"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Opening list */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-1">
        {filtered.map((opening) => (
          <button
            key={`${opening.eco}-${opening.name}`}
            onClick={() => handleSelectOpening(opening)}
            className="w-full text-left px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-500 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm text-white group-hover:text-blue-300 transition-colors">
                {opening.name}
              </span>
              <span className="text-xs font-mono text-zinc-500">{opening.eco}</span>
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">{opening.category}</div>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-zinc-500 text-sm text-center mt-4">No openings found</p>
        )}
      </div>
    </div>
  );
};

export default OpeningsPanel;
