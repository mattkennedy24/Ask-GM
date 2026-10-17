interface EvalBarProps {
  /** How much of the bar White owns, 0 to 100. */
  whiteShare: number;
  /** For screen readers: "White edge", "Black winning", "Checkmate · White wins". */
  label: string;
  orientation: "vertical" | "horizontal";
  /** The board is flipped: Black is at the bottom, so the bar's colours swap ends. */
  flipped?: boolean;
  /** The value shown is the last known one while a new position is being analysed. */
  stale?: boolean;
}

/** Who is winning, as a bar: White's share in white, Black's in ink. */
export default function EvalBar({ whiteShare, label, orientation, flipped = false, stale = false }: EvalBarProps) {
  return (
    <div
      role="img"
      aria-label={`Evaluation: ${label || "waiting for analysis"}`}
      title={label}
      className={`eval-bar eval-bar-${orientation} ${flipped ? "eval-bar-flipped" : ""}`}
      data-stale={stale ? "" : undefined}
    >
      <div className="eval-white" style={{ ["--share" as string]: `${whiteShare}%` }} />
    </div>
  );
}
