import { useCallback, useEffect, useRef, useState } from "react";
import { MULTI_PV, UciAnalyzer } from "../engine/analyzer";
import { fetchCloudEval } from "../engine/lichess";
import type { EngineLine } from "../engine/uci";

/**
 * "starting" – the worker is loading
 * "ready"    – analysing locally with Stockfish
 * "fallback" – the worker is unavailable; using Lichess's cloud cache instead
 */
export type EngineStatus = "starting" | "ready" | "fallback";

export interface EngineState {
  /** The position `lines` belong to (null until the first request). */
  fen: string | null;
  lines: EngineLine[];
  thinking: boolean;
  status: EngineStatus;
}

// The engine files are copied from the `stockfish` package into /engine at build time (see vite.config.ts).
const ENGINE_SCRIPT = `${import.meta.env.BASE_URL}engine/stockfish-16-single.js`;
const ENGINE_WASM = `${import.meta.env.BASE_URL}engine/stockfish-16-single.wasm`;

const INITIAL: EngineState = { fen: null, lines: [], thinking: false, status: "starting" };

/**
 * Runs Stockfish in a Web Worker and exposes the latest analysis.
 *
 * Call `analyze(fen)` whenever the position changes. Results are only ever
 * published for the most recently requested position, so a slow search for a
 * position you have already left can never overwrite the current one.
 */
export function useStockfish() {
  const [state, setState] = useState<EngineState>(INITIAL);
  const analyzerRef = useRef<UciAnalyzer | null>(null);
  const wantedRef = useRef<string | null>(null);
  const fallbackRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const runFallback = useCallback(async (fen: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const lines = await fetchCloudEval(fen, MULTI_PV, controller.signal);
    if (controller.signal.aborted || wantedRef.current !== fen) return;
    setState((s) => ({ ...s, fen, lines, thinking: false }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let analyzer: UciAnalyzer | null = null;

    const switchToFallback = () => {
      if (cancelled) return;
      analyzerRef.current = null;
      fallbackRef.current = true;
      setState((s) => ({ ...s, status: "fallback" }));
      if (wantedRef.current) void runFallback(wantedRef.current);
    };

    try {
      const worker = new Worker(`${ENGINE_SCRIPT}#${encodeURIComponent(ENGINE_WASM)}`);
      analyzer = new UciAnalyzer(worker, {
        onReady: () => {
          if (!cancelled) setState((s) => ({ ...s, status: "ready" }));
        },
        onUpdate: (update) => {
          if (cancelled || update.fen !== wantedRef.current) return;
          setState((s) => ({ ...s, fen: update.fen, lines: update.lines, thinking: update.thinking }));
        },
        onError: (message) => {
          console.warn(`Stockfish unavailable (${message}); falling back to Lichess cloud evaluations.`);
          switchToFallback();
        },
      });
      analyzerRef.current = analyzer;
      // A position may have been requested before the worker existed (first render, StrictMode remount).
      if (wantedRef.current) analyzer.analyze(wantedRef.current);
    } catch (error) {
      console.warn("Could not start the Stockfish worker; using Lichess cloud evaluations.", error);
      switchToFallback();
    }

    return () => {
      cancelled = true;
      analyzer?.dispose();
      analyzerRef.current = null;
      abortRef.current?.abort();
    };
  }, [runFallback]);

  const analyze = useCallback(
    (fen: string) => {
      wantedRef.current = fen;
      setState((s) => ({ ...s, fen, lines: [], thinking: true }));
      if (analyzerRef.current) analyzerRef.current.analyze(fen);
      else if (fallbackRef.current) void runFallback(fen);
      // Otherwise the worker is still being created; the effect above picks up wantedRef.
    },
    [runFallback],
  );

  const top = state.lines[0];
  return {
    ...state,
    analyze,
    bestMove: top?.pv[0] ?? null,
    evalScore: top?.score ?? null,
    mateIn: top?.mate ?? null,
  };
}
