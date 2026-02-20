import React, { useMemo } from "react";

interface EvalBarProps {
  /** Centipawns from white's perspective (±9999 for forced mate). Null = unknown. */
  evalScore: number | null;
  /** Forced mate in N moves (positive = white wins, negative = black wins). Null if none. */
  mateIn: number | null;
  /** Whether Stockfish is still analysing. */
  thinking: boolean;
}

/**
 * Convert centipawn score to a percentage (0–100) for the white portion of the bar.
 * 50 = equal; uses tanh so extremes are smoothly clamped.
 */
function cpToPercent(cp: number): number {
  return 50 + 50 * Math.tanh(cp / 400);
}

const EvalBar: React.FC<EvalBarProps> = ({ evalScore, mateIn, thinking }) => {
  const { whitePercent, label } = useMemo(() => {
    if (evalScore === null) return { whitePercent: 50, label: "=" };

    if (mateIn !== null) {
      const isWhiteWin = mateIn > 0;
      return {
        whitePercent: isWhiteWin ? 97 : 3,
        label: `M${Math.abs(mateIn)}`,
      };
    }

    const pct = cpToPercent(evalScore);
    const abs = Math.abs(evalScore);
    const pawns = (abs / 100).toFixed(abs >= 100 ? 1 : 2);
    const sign = evalScore > 0 ? "+" : evalScore < 0 ? "-" : "";
    const label = evalScore === 0 ? "0.00" : `${sign}${pawns}`;
    return { whitePercent: pct, label };
  }, [evalScore, mateIn]);

  const blackPercent = 100 - whitePercent;

  return (
    <div className="flex flex-col items-center gap-1 select-none" title="Engine evaluation">
      {/* Vertical bar (desktop) */}
      <div className="hidden md:flex flex-col w-5 rounded overflow-hidden shadow-inner border border-zinc-600"
        style={{ height: 480 }}>
        {/* Black portion (top) */}
        <div
          className="bg-zinc-900 transition-all duration-500"
          style={{ height: `${blackPercent}%` }}
        />
        {/* White portion (bottom) */}
        <div
          className="bg-zinc-100 transition-all duration-500"
          style={{ height: `${whitePercent}%` }}
        />
      </div>

      {/* Horizontal bar (mobile) */}
      <div className="flex md:hidden w-full h-4 rounded overflow-hidden shadow-inner border border-zinc-600">
        {/* White portion (left) */}
        <div
          className="bg-zinc-100 transition-all duration-500"
          style={{ width: `${whitePercent}%` }}
        />
        {/* Black portion (right) */}
        <div
          className="bg-zinc-900 transition-all duration-500"
          style={{ width: `${blackPercent}%` }}
        />
      </div>

      {/* Score label */}
      <div
        className={`text-xs font-mono font-bold tabular-nums transition-opacity ${
          thinking ? "opacity-40" : "opacity-100"
        } ${
          evalScore !== null && evalScore > 0
            ? "text-zinc-100"
            : evalScore !== null && evalScore < 0
            ? "text-zinc-400"
            : "text-zinc-400"
        }`}
      >
        {thinking && evalScore === null ? "..." : label}
      </div>
    </div>
  );
};

export default EvalBar;
