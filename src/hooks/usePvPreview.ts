import { useCallback, useMemo, useState } from "react";
import { Chess } from "chess.js";
import type { EngineLine } from "../engine/uci";

/**
 * Step through an engine line on the board without changing the game.
 *
 * The preview belongs to one position: it is dropped as soon as the base position
 * changes, so a line chosen for one position can never be shown on another.
 */
export function usePvPreview(baseFen: string, lines: readonly EngineLine[]) {
  const [selection, setSelection] = useState<{ fen: string; line: number; step: number } | null>(null);

  // Only a selection made for the position on screen counts.
  const active = selection && selection.fen === baseFen && lines[selection.line] ? selection : null;
  const pv = active ? lines[active.line].pv : null;

  const preview = useMemo(() => {
    if (!active || !pv) return null;
    const chess = new Chess(baseFen);
    let lastMove: { from: string; to: string } | null = null;
    for (let i = 0; i <= active.step && i < pv.length; i++) {
      try {
        const move = chess.move({ from: pv[i].slice(0, 2), to: pv[i].slice(2, 4), promotion: pv[i][4] });
        lastMove = { from: move.from, to: move.to };
      } catch {
        break;
      }
    }
    return { fen: chess.fen(), lastMove };
  }, [active, pv, baseFen]);

  /** Toggle a line: select it (showing its first move) or, if already selected, close it. */
  const select = useCallback(
    (line: number) => {
      setSelection((s) => (s && s.fen === baseFen && s.line === line ? null : { fen: baseFen, line, step: 0 }));
    },
    [baseFen],
  );

  const stepBy = useCallback(
    (direction: 1 | -1) => {
      setSelection((s) => {
        if (!s || s.fen !== baseFen) return s;
        const length = lines[s.line]?.pv.length ?? 0;
        return { ...s, step: Math.max(0, Math.min(s.step + direction, length - 1)) };
      });
    },
    [baseFen, lines],
  );

  const exit = useCallback(() => setSelection(null), []);

  return {
    selectedLine: active ? active.line : -1,
    step: active ? active.step : -1,
    length: pv?.length ?? 0,
    /** The position and last move to show instead of the game's, or null when not previewing. */
    preview,
    select,
    stepBy,
    exit,
  };
}
