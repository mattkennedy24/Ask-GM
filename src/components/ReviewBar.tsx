import type { ReviewProgress } from "../engine/reviewQueue";
import { describeSide, type ReviewSummary } from "../lib/reviewSummary";

interface ReviewBarProps {
  /** Plies in the game: a review is only offered once there is something to review. */
  plies: number;
  /** A review has already been run on this game. */
  reviewed: boolean;
  progress: ReviewProgress;
  /** The review engine could not start, so there is nothing to offer. */
  unavailable: boolean;
  /** How many moves were flagged (inaccuracy, mistake or blunder). */
  flagged: number;
  onStart: () => void;
  onStop: () => void;
  onNext: () => void;
}

const MIN_PLIES_TO_REVIEW = 4;

/** The review controls for the move list's header: start, progress, then "next mistake". */
export function ReviewControls({ plies, reviewed, progress, unavailable, flagged, onStart, onStop, onNext }: ReviewBarProps) {
  if (unavailable) return null;

  if (progress.running) {
    return (
      <div className="review-controls">
        <p className="type-small num muted" role="status">
          Reviewing {progress.done}/{progress.total}
        </p>
        <button type="button" className="btn btn-compact" onClick={onStop}>
          Stop
        </button>
      </div>
    );
  }

  // Offered once per game, so it does not come and go as the verdicts for your latest moves arrive.
  const canReview = !reviewed && plies >= MIN_PLIES_TO_REVIEW;
  if (flagged === 0 && !canReview) return null;
  return (
    <div className="review-controls">
      {flagged > 0 && (
        <button type="button" className="btn btn-compact" onClick={onNext}>
          Next mistake
        </button>
      )}
      {canReview && (
        <button type="button" className="btn btn-compact" onClick={onStart}>
          Review game
        </button>
      )}
    </div>
  );
}

/** The thin bar under the header while a review runs. */
export function ReviewProgressBar({ progress }: { progress: ReviewProgress }) {
  if (!progress.running) return null;
  const share = progress.total > 0 ? (progress.done / progress.total) * 100 : 0;
  return <div className="review-progress" aria-hidden="true" style={{ ["--done" as string]: `${share}%` }} />;
}

/** What the review found, in a line per side. */
export function ReviewSummaryRows({ summary }: { summary: ReviewSummary | null }) {
  if (!summary) return null;
  return (
    <div className="review-summary type-small">
      <p>
        <span className="type-label muted">White</span> {describeSide(summary.white)}
      </p>
      <p>
        <span className="type-label muted">Black</span> {describeSide(summary.black)}
      </p>
    </div>
  );
}
