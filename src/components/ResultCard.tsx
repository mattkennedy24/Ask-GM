import { type GameOutcome, outcomeDetail, outcomeHeadline, outcomeNotation } from "../lib/outcome";

interface ResultCardProps {
  outcome: GameOutcome;
  gmName: string;
  onNewGame: () => void;
  onAsk: () => void;
  askDisabled: boolean;
}

/** The end of a game, in the manner of a scoresheet: the result, in words, with the obvious next steps. */
export default function ResultCard({ outcome, gmName, onNewGame, onAsk, askDisabled }: ResultCardProps) {
  return (
    <section className="result stamp" aria-label="Game result">
      <div className="result-text">
        <p className="type-label muted">Final result {outcomeNotation(outcome)}</p>
        <h2 className="type-display">{outcomeHeadline(outcome)}</h2>
        <p className="type-lead soft">{outcomeDetail(outcome)}</p>
      </div>
      <div className="result-actions">
        <button type="button" className="btn btn-primary" onClick={onNewGame}>
          New game
        </button>
        <button type="button" className="btn" onClick={onAsk} disabled={askDisabled}>
          Ask {gmName} about it
        </button>
      </div>
    </section>
  );
}
