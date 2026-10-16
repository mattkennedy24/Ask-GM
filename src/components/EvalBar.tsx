import { useEffect, useState } from "react";
import { evalLabel, whiteShare } from "../lib/evaluation";

interface EvalBarProps {
  score: number | null;
  mate: number | null;
  thinking: boolean;
  orientation: "vertical" | "horizontal";
  /** The board is flipped: Black is at the bottom, so the bar's colours swap ends. */
  flipped?: boolean;
}

const WHITE = "#f0e8d8";
const BLACK = "#0a0a12";

/**
 * Who is winning, as a bar. While a new position is being analysed the bar holds
 * the last value (dimmed) instead of snapping back to "equal" on every move.
 */
export default function EvalBar({ score, mate, thinking, orientation, flipped = false }: EvalBarProps) {
  const [lastKnown, setLastKnown] = useState<{ score: number | null; mate: number | null }>({ score: null, mate: null });

  useEffect(() => {
    if (score !== null || mate !== null) setLastKnown({ score, mate });
  }, [score, mate]);

  const stale = score === null && mate === null;
  const shown = stale ? lastKnown : { score, mate };
  const white = whiteShare(shown.score, shown.mate);
  const black = 100 - white;
  const label = evalLabel(shown.score, shown.mate) || "Waiting for analysis";

  const dim = stale && thinking ? 0.45 : 1;
  const frame = { border: "1px solid var(--c-border-mid)", opacity: dim, transition: "opacity 300ms ease" };

  if (orientation === "vertical") {
    // White's colour sits at the bottom, unless the board is flipped.
    const top = flipped ? WHITE : BLACK;
    const bottom = flipped ? BLACK : WHITE;
    const topShare = flipped ? white : black;
    const bottomShare = flipped ? black : white;
    return (
      <div role="img" aria-label={`Evaluation: ${label}`} title={label} className="flex h-full w-4 flex-col overflow-hidden rounded-sm" style={{ ...frame, minHeight: 60 }}>
        <div className="eval-fill" style={{ height: `${topShare}%`, background: top }} />
        <div className="eval-fill" style={{ height: `${bottomShare}%`, background: bottom }} />
      </div>
    );
  }

  const left = flipped ? BLACK : WHITE;
  const right = flipped ? WHITE : BLACK;
  const leftShare = flipped ? black : white;
  const rightShare = flipped ? white : black;
  return (
    <div role="img" aria-label={`Evaluation: ${label}`} title={label} className="flex h-2 w-full overflow-hidden rounded-sm" style={frame}>
      <div className="eval-fill" style={{ width: `${leftShare}%`, background: left }} />
      <div className="eval-fill" style={{ width: `${rightShare}%`, background: right }} />
    </div>
  );
}
