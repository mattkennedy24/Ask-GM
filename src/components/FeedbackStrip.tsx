import type { ReactNode } from "react";
import { formatLoss, type MoveVerdict, verdictGlyph, verdictLabel } from "../lib/moveReview";
import { Check } from "./icons";

export type Feedback =
  | { kind: "hint"; text: string }
  | { kind: "checking" }
  | { kind: "note"; text: string }
  | {
      kind: "verdict";
      verdict: MoveVerdict;
      /** The move as written in a score: "12...Nxe4". */
      move: string;
      /** The engine's preferred move in SAN, when it differs from the one played. */
      preferred: string | null;
      onTryInstead?: () => void;
    };

function Badge({ verdict }: { verdict: MoveVerdict }) {
  const glyph = verdictGlyph(verdict.quality);
  return (
    <span className={`glyph glyph-${verdict.quality} pop`} aria-hidden="true">
      {glyph || <Check size={14} strokeWidth={2.5} />}
    </span>
  );
}

function sentence(feedback: Extract<Feedback, { kind: "verdict" }>): ReactNode {
  const { verdict, move, preferred } = feedback;
  if (verdict.quality === "best") return `${move} is the engine's top choice.`;
  if (verdict.quality === "good") return `${move} is sound: close to the engine's best.`;
  return (
    <>
      {move} gave up about {formatLoss(verdict.lossCp)} pawns.
      {preferred ? ` The engine preferred ${preferred}.` : ""}
    </>
  );
}

/** One quiet line under the board: how your last move was judged, or the note for the lesson move. */
export default function FeedbackStrip({ feedback }: { feedback: Feedback }) {
  if (feedback.kind === "verdict") {
    const { verdict, preferred, onTryInstead } = feedback;
    const bad = verdict.quality === "inaccuracy" || verdict.quality === "mistake" || verdict.quality === "blunder";
    return (
      <div className="feedback" aria-live="polite">
        <Badge verdict={verdict} />
        <p className="type-small">
          <strong>{verdictLabel(verdict.quality)}.</strong> {sentence(feedback)}
          {bad && preferred && onTryInstead && (
            <>
              {" "}
              <button type="button" className="link" onClick={onTryInstead}>
                Take it back and play {preferred}
              </button>
            </>
          )}
        </p>
      </div>
    );
  }

  if (feedback.kind === "note") {
    return (
      <div className="feedback feedback-note" role="status">
        <p className="type-lead">{feedback.text}</p>
      </div>
    );
  }

  // Nothing to say: no empty strip.
  if (feedback.kind === "hint" && !feedback.text) return null;

  return (
    <div className="feedback" aria-live="polite">
      <p className="type-small muted">
        {feedback.kind === "checking" ? (
          <>
            Checking that move <span className="dots" aria-hidden="true"><span /><span /><span /></span>
          </>
        ) : (
          feedback.text
        )}
      </p>
    </div>
  );
}
