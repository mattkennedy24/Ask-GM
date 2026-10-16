import { useEffect, useRef } from "react";

interface MoveNotationProps {
  /** Every move of the line in SAN, including any beyond the position on screen. */
  sanMoves: string[];
  /** Position on screen: 0 = start, n = after n plies. */
  index: number;
  onNavigate: (index: number) => void;
}

/** The move list as numbered pairs. Click a move to jump to the position after it. */
export default function MoveNotation({ sanMoves, index, onNavigate }: MoveNotationProps) {
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
    return (
      <p className="px-1 text-xs" style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-mono)" }}>
        No moves yet — make a move on the board.
      </p>
    );
  }

  const pairs: { number: number; white: string; black: string | null }[] = [];
  for (let i = 0; i < sanMoves.length; i += 2) {
    pairs.push({ number: i / 2 + 1, white: sanMoves[i], black: sanMoves[i + 1] ?? null });
  }

  const moveButton = (san: string, plyIndex: number) => (
    <button
      type="button"
      onClick={() => onNavigate(plyIndex)}
      aria-current={index === plyIndex ? "true" : undefined}
      className="rounded px-1.5 py-0.5 text-xs"
      style={{
        fontFamily: "var(--f-mono)",
        fontWeight: index === plyIndex ? 600 : 400,
        background: index === plyIndex ? "var(--c-gold-dim)" : "transparent",
        color: index === plyIndex ? "var(--c-gold-bright)" : "var(--c-text-soft)",
        border: `1px solid ${index === plyIndex ? "var(--c-gold)" : "transparent"}`,
      }}
    >
      {san}
    </button>
  );

  return (
    <div ref={containerRef} role="group" aria-label="Moves" className="relative flex flex-wrap items-center gap-x-0.5 gap-y-0.5 overflow-y-auto" style={{ maxHeight: "4.75rem" }}>
      <button
        type="button"
        onClick={() => onNavigate(0)}
        aria-current={index === 0 ? "true" : undefined}
        aria-label="Starting position"
        className="rounded px-1.5 py-0.5 text-xs"
        style={{
          fontFamily: "var(--f-mono)",
          color: index === 0 ? "var(--c-gold-bright)" : "var(--c-text-muted)",
          border: `1px solid ${index === 0 ? "var(--c-gold)" : "transparent"}`,
        }}
      >
        Start
      </button>
      {pairs.map((pair) => (
        <span key={pair.number} className="inline-flex items-center">
          <span className="select-none px-0.5 text-xs tabular-nums" style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-mono)" }}>
            {pair.number}.
          </span>
          {moveButton(pair.white, pair.number * 2 - 1)}
          {pair.black !== null && moveButton(pair.black, pair.number * 2)}
        </span>
      ))}
    </div>
  );
}
