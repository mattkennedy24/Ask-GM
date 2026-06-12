import React, { useMemo } from "react";

interface EvalBarProps {
  evalScore: number | null;
  mateIn: number | null;
  thinking: boolean;
}

function cpToPercent(cp: number): number {
  return 50 + 50 * Math.tanh(cp / 400);
}

const EvalBar: React.FC<EvalBarProps> = ({ evalScore, mateIn, thinking }) => {
  const { whitePercent, label, isWhiteAhead } = useMemo(() => {
    if (evalScore === null) return { whitePercent: 50, label: "=", isWhiteAhead: false };

    if (mateIn !== null) {
      const isWhiteWin = mateIn > 0;
      return {
        whitePercent: isWhiteWin ? 97 : 3,
        label: `M${Math.abs(mateIn)}`,
        isWhiteAhead: isWhiteWin,
      };
    }

    const pct = cpToPercent(evalScore);
    const abs = Math.abs(evalScore);
    const pawns = (abs / 100).toFixed(abs >= 100 ? 1 : 2);
    const sign = evalScore > 0 ? "+" : evalScore < 0 ? "−" : "";
    const displayLabel = evalScore === 0 ? "0.00" : `${sign}${pawns}`;
    return { whitePercent: pct, label: displayLabel, isWhiteAhead: evalScore > 0 };
  }, [evalScore, mateIn]);

  const blackPercent = 100 - whitePercent;

  const labelColor = isWhiteAhead
    ? "#F0E8D8"
    : evalScore !== null && evalScore < 0
    ? "var(--c-text-soft)"
    : "var(--c-text-muted)";

  const isLoading = thinking && evalScore === null;

  return (
    <div className="flex flex-col items-center gap-1.5 select-none" title={`Evaluation: ${label}`}>
      {/* ── Vertical bar (desktop) ── */}
      <div
        className="hidden md:flex flex-col h-full w-4 rounded-sm overflow-hidden"
        style={{ border: "1px solid var(--c-border-mid)", minHeight: 60 }}
      >
        <div
          className="eval-fill"
          style={{ height: `${blackPercent}%`, background: "#0a0a12" }}
        />
        <div
          className="eval-fill"
          style={{ height: `${whitePercent}%`, background: "#F0E8D8" }}
        />
      </div>

      {/* ── Horizontal bar (mobile) ── */}
      <div
        className="flex md:hidden w-full h-2.5 rounded-sm overflow-hidden"
        style={{ border: "1px solid var(--c-border-mid)" }}
      >
        <div
          className="eval-fill"
          style={{ width: `${whitePercent}%`, background: "#F0E8D8" }}
        />
        <div
          className="eval-fill"
          style={{ width: `${blackPercent}%`, background: "#0a0a12" }}
        />
      </div>

      {/* ── Score label ── */}
      <div
        className="w-full text-center tabular-nums"
        style={{
          color: labelColor,
          fontFamily: "var(--f-mono)",
          fontSize: "15px",
          fontWeight: 600,
          opacity: isLoading ? 0.3 : 1,
          letterSpacing: "0.02em",
          transition: "opacity 300ms ease, color 300ms ease",
        }}
      >
        {isLoading ? "…" : label}
      </div>
    </div>
  );
};

export default EvalBar;
