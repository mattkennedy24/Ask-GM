import { useCallback, useEffect, useMemo, useState } from "react";
import type { Opening } from "../data/openings";
import { buildPositions, moveSquares, sanUpTo, uciUpTo } from "../lib/lines";

interface LessonState {
  opening: Opening | null;
  /** -1 = main line, otherwise an index into opening.variations */
  variation: number;
  /** Position on screen: 0 = start, n = after n plies. */
  index: number;
  playing: boolean;
}

const IDLE: LessonState = { opening: null, variation: -1, index: 0, playing: false };
const STEP_DELAY_MS = 800;

/**
 * An opening lesson: which line is open, how far through it we are, and auto-play.
 * Everything (positions, highlight, annotation) is derived from that state, so the
 * board can never show a different position from the one the lesson thinks it is on.
 */
export function useLesson() {
  const [state, setState] = useState<LessonState>(IDLE);
  const { opening, variation, index, playing } = state;

  const line = useMemo(() => {
    if (!opening) return null;
    return variation >= 0 ? (opening.variations?.[variation] ?? opening) : opening;
  }, [opening, variation]);

  const plies = useMemo(() => buildPositions(line?.moves ?? []), [line]);
  const lastIndex = plies.length - 1;
  const ply = plies[Math.min(index, lastIndex)];

  // Auto-play: advance one move at a time until the end of the line.
  useEffect(() => {
    if (!playing) return;
    if (index >= lastIndex) {
      setState((s) => ({ ...s, playing: false }));
      return;
    }
    const timer = setTimeout(() => setState((s) => (s.playing ? { ...s, index: s.index + 1 } : s)), STEP_DELAY_MS);
    return () => clearTimeout(timer);
  }, [playing, index, lastIndex]);

  /** Stop auto-play without touching anything else (used when the lesson goes off screen). */
  const pause = useCallback(() => setState((s) => (s.playing ? { ...s, playing: false } : s)), []);

  const select = useCallback((next: Opening) => setState({ opening: next, variation: -1, index: 0, playing: false }), []);
  const exit = useCallback(() => setState(IDLE), []);
  const selectVariation = useCallback(
    (next: number) => setState((s) => ({ ...s, variation: next, index: 0, playing: false })),
    [],
  );
  const navigate = useCallback(
    (next: number) => setState((s) => ({ ...s, index: Math.max(0, Math.min(next, lastIndex)), playing: false })),
    [lastIndex],
  );
  const back = useCallback(() => navigate(index - 1), [navigate, index]);
  const forward = useCallback(() => navigate(index + 1), [navigate, index]);
  const togglePlay = useCallback(
    () => setState((s) => (s.playing ? { ...s, playing: false } : { ...s, index: s.index >= lastIndex ? 0 : s.index, playing: true })),
    [lastIndex],
  );

  const annotations = line && "annotations" in line ? line.annotations : undefined;
  const lists = useMemo(
    () => ({
      sanMoves: sanUpTo(plies, lastIndex),
      playedSan: sanUpTo(plies, index),
      playedUci: uciUpTo(plies, index),
    }),
    [plies, lastIndex, index],
  );

  return {
    opening,
    variation,
    line,
    plies,
    index: Math.min(index, lastIndex),
    playing,
    fen: ply.fen,
    lastMove: moveSquares(ply),
    ...lists,
    /** The coaching note for the move just played, if the lesson has one. */
    annotation: index > 0 ? annotations?.[index - 1] || null : null,
    canBack: index > 0,
    canForward: index < lastIndex,
    select,
    exit,
    selectVariation,
    navigate,
    back,
    forward,
    togglePlay,
    pause,
  };
}

export type Lesson = ReturnType<typeof useLesson>;
