import { useEffect, useRef } from "react";
import { type MoveVerdict, verdictGlyph, verdictLabel } from "../lib/moveReview";

interface MoveNotationProps {
  /** Every move of the line in SAN, including any beyond the position on screen. */
  sanMoves: string[];
  /** How each move was judged, aligned with `sanMoves` (null while unknown). */
  verdicts: (MoveVerdict | null)[];
  /** Position on screen: 0 = start, n = after n plies. */
  index: number;
  onNavigate: (index: number) => void;
}

/** The move list as numbered pairs. Click a move to jump to the position after it. */
export default function MoveNotation({ sanMoves, verdicts, index, onNavigate }: MoveNotationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the current move visible by scrolling the list itself. (scrollIntoView would also scroll the
  // page, which on a phone yanks the board out of view.)
  useEffect(() => {
    const container = containerRef.current;
    const current = container?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!container || !current) return;
    const top = current.offsetTop - container.offsetTop;
    if (top < container.scrollTop) container.scrollTop = top;
    else if (top + current.offsetHeight > container.scrollTop + container.clientHeight) {
      container.scrollTop = top + current.offsetHeight - container.clientHeight;
    }
  }, [index, sanMoves.length]);

  if (sanMoves.length === 0) {
    return <p className="type-small muted moves-empty">No moves yet. Make a move on the board.</p>;
  }

  const pairs: { number: number; white: string; black: string | null }[] = [];
  for (let i = 0; i < sanMoves.length; i += 2) {
    pairs.push({ number: i / 2 + 1, white: sanMoves[i], black: sanMoves[i + 1] ?? null });
  }

  const moveButton = (san: string, plyIndex: number) => {
    const verdict = verdicts[plyIndex - 1] ?? null;
    const glyph = verdict ? verdictGlyph(verdict.quality) : "";
    return (
      <button
        type="button"
        onClick={() => onNavigate(plyIndex)}
        aria-current={index === plyIndex ? "true" : undefined}
        aria-label={verdict && glyph ? `${san}, ${verdictLabel(verdict.quality).toLowerCase()}` : san}
        className="move-chip num"
      >
        {san}
        {glyph && (
          <span className={`mark mark-${verdict?.quality}`} aria-hidden="true">
            {glyph}
          </span>
        )}
      </button>
    );
  };

  return (
    <div ref={containerRef} role="group" aria-label="Moves" className="moves">
      <button type="button" onClick={() => onNavigate(0)} aria-current={index === 0 ? "true" : undefined} aria-label="Starting position" className="move-chip">
        Start
      </button>
      {pairs.map((pair) => (
        <span key={pair.number} className="move-pair">
          <span className="move-number type-small num muted" aria-hidden="true">
            {pair.number}.
          </span>
          {moveButton(pair.white, pair.number * 2 - 1)}
          {pair.black !== null && moveButton(pair.black, pair.number * 2)}
        </span>
      ))}
    </div>
  );
}
