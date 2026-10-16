import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import { type AnalyzerUpdate, UciAnalyzer, type WorkerLike } from "./analyzer";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const AFTER_D4 = "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1";
const AFTER_C4 = "rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq - 0 1";

/** A scripted stand-in for the Stockfish worker. */
class FakeEngine implements WorkerLike {
  sent: string[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  postMessage(message: string) {
    this.sent.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  say(line: string) {
    this.onmessage?.({ data: line } as MessageEvent);
  }
  /** Complete the uci/isready handshake. */
  handshake() {
    this.say("uciok");
    this.say("readyok");
  }
  info(depth: number, multipv: number, cp: number, pv: string) {
    this.say(`info depth ${depth} seldepth ${depth + 2} multipv ${multipv} score cp ${cp} nodes 1000 pv ${pv}`);
  }
  get goCount() {
    return this.sent.filter((m) => m.startsWith("go ")).length;
  }
  get lastPosition() {
    return [...this.sent].reverse().find((m) => m.startsWith("position "));
  }
}

function setup(options: ConstructorParameters<typeof UciAnalyzer>[2] = {}) {
  const engine = new FakeEngine();
  const updates: AnalyzerUpdate[] = [];
  const onError = vi.fn();
  const onReady = vi.fn();
  const analyzer = new UciAnalyzer(engine, { onUpdate: (u) => updates.push(u), onError, onReady }, { throttleMs: 0, ...options });
  return { engine, analyzer, updates, onError, onReady };
}

describe("UciAnalyzer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("performs the UCI handshake and configures MultiPV and hash", () => {
    const { engine, onReady } = setup();
    expect(engine.sent).toEqual(["uci"]);
    engine.say("uciok");
    expect(engine.sent).toContain("setoption name MultiPV value 3");
    expect(engine.sent).toContain("setoption name Hash value 32");
    expect(engine.sent.at(-1)).toBe("isready");
    expect(onReady).not.toHaveBeenCalled();
    engine.say("readyok");
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("queues a request made before the engine is ready and runs it afterwards", () => {
    const { engine, analyzer } = setup();
    analyzer.analyze(START);
    expect(engine.goCount).toBe(0);
    engine.handshake();
    expect(engine.lastPosition).toBe(`position fen ${START}`);
    expect(engine.goCount).toBe(1);
  });

  it("publishes complete iterations and a final result", () => {
    const { engine, analyzer, updates } = setup();
    engine.handshake();
    analyzer.analyze(START);

    engine.info(10, 1, 30, "e2e4 e7e5");
    engine.info(10, 2, 25, "d2d4 d7d5");
    expect(updates).toHaveLength(0); // incomplete iteration: only 2 of 3 lines

    engine.info(10, 3, 20, "g1f3 g8f6");
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ fen: START, thinking: true });
    expect(updates[0].lines.map((l) => l.pv[0])).toEqual(["e2e4", "d2d4", "g1f3"]);

    engine.say("bestmove e2e4 ponder e7e5");
    expect(updates.at(-1)).toMatchObject({ fen: START, thinking: false });
    expect(updates.at(-1)?.lines).toHaveLength(3);
  });

  it("converts scores to White's point of view when Black is to move", () => {
    const { engine, analyzer, updates } = setup();
    engine.handshake();
    analyzer.analyze(AFTER_E4);
    engine.info(12, 1, 40, "e7e5");
    engine.info(12, 2, 35, "c7c5");
    engine.info(12, 3, 30, "e7e6");
    expect(updates[0].lines.map((l) => l.score)).toEqual([-40, -35, -30]);
    expect(updates[0].lines.every((l) => l.mate === null)).toBe(true);

    // A mate for the side to move (Black) is a mate against White.
    engine.say("info depth 13 multipv 1 score mate 2 pv d8h4");
    engine.say("info depth 13 multipv 2 score cp 10 pv c7c5");
    engine.say("info depth 13 multipv 3 score cp 5 pv e7e6");
    expect(updates[1].lines[0]).toMatchObject({ mate: -2, score: -9999 });
  });

  it("never mistakes the stopped search's bestmove for the new position's answer", () => {
    const { engine, analyzer, updates } = setup();
    engine.handshake();
    analyzer.analyze(START);
    engine.info(10, 1, 30, "e2e4 e7e5");

    analyzer.analyze(AFTER_E4); // user moved while the first search was running
    expect(engine.sent.at(-1)).toBe("stop");
    expect(engine.goCount).toBe(1); // the new search must NOT start until the old one has finished

    engine.say("bestmove e2e4"); // this belongs to START, not AFTER_E4
    expect(updates).toHaveLength(0); // ...and must not be published at all
    expect(engine.lastPosition).toBe(`position fen ${AFTER_E4}`);
    expect(engine.goCount).toBe(2);

    engine.info(11, 1, 20, "e7e5");
    engine.info(11, 2, 10, "c7c5");
    engine.info(11, 3, 5, "e7e6");
    expect(updates.every((u) => u.fen === AFTER_E4)).toBe(true);
    engine.say("bestmove e7e5");
    expect(updates.at(-1)).toMatchObject({ fen: AFTER_E4, thinking: false });
  });

  it("collapses rapid navigation into a single follow-up search", () => {
    const { engine, analyzer } = setup();
    engine.handshake();
    analyzer.analyze(START);
    analyzer.analyze(AFTER_E4);
    analyzer.analyze(AFTER_D4);
    analyzer.analyze(AFTER_C4);
    expect(engine.sent.filter((m) => m === "stop")).toHaveLength(1);

    engine.say("bestmove e2e4");
    expect(engine.goCount).toBe(2);
    expect(engine.lastPosition).toBe(`position fen ${AFTER_C4}`);
  });

  it("ignores a repeated request for the position already being searched", () => {
    const { engine, analyzer } = setup();
    engine.handshake();
    analyzer.analyze(START);
    analyzer.analyze(START);
    expect(engine.goCount).toBe(1);
    expect(engine.sent).not.toContain("stop");
  });

  it("does not search finished games, and cancels a running search", () => {
    const mated = new Chess();
    for (const san of ["f3", "e5", "g4", "Qh4#"]) mated.move(san);
    const { engine, analyzer, updates } = setup();
    engine.handshake();

    analyzer.analyze(START);
    analyzer.analyze(mated.fen());
    expect(updates.at(-1)).toEqual({ fen: mated.fen(), lines: [], thinking: false });
    expect(engine.sent.at(-1)).toBe("stop");

    engine.say("bestmove e2e4"); // the cancelled search's answer is discarded
    expect(engine.goCount).toBe(1);
    expect(updates).toHaveLength(1);
  });

  it("falls back to the bare best move when the engine reported no analysis lines", () => {
    const { engine, analyzer, updates } = setup();
    engine.handshake();
    analyzer.analyze(START);
    engine.say("bestmove g1f3");
    expect(updates.at(-1)).toEqual({ fen: START, lines: [{ pv: ["g1f3"], score: null, mate: null }], thinking: false });
  });

  it("ignores aspiration-window bounds and too-shallow iterations while searching", () => {
    const { engine, analyzer, updates } = setup();
    engine.handshake();
    analyzer.analyze(START);
    engine.info(3, 1, 10, "e2e4");
    engine.info(3, 2, 5, "d2d4");
    engine.info(3, 3, 0, "g1f3");
    expect(updates).toHaveLength(0);

    engine.say("info depth 12 multipv 1 score cp 500 lowerbound pv e2e4");
    expect(updates).toHaveLength(0);
  });

  it("throttles intermediate updates but always delivers the final one", () => {
    let now = 1000;
    const { engine, analyzer, updates } = setup({ throttleMs: 200, now: () => now });
    engine.handshake();
    analyzer.analyze(START);
    const iteration = (depth: number) => {
      engine.info(depth, 1, 10, "e2e4");
      engine.info(depth, 2, 5, "d2d4");
      engine.info(depth, 3, 0, "g1f3");
    };
    iteration(9);
    now += 50;
    iteration(10); // inside the throttle window
    expect(updates).toHaveLength(1);
    now += 300;
    iteration(11);
    expect(updates).toHaveLength(2);
    engine.say("bestmove e2e4");
    expect(updates).toHaveLength(3);
    expect(updates[2].thinking).toBe(false);
  });

  it("reports a crash and refuses further work", () => {
    const { engine, analyzer, onError } = setup();
    engine.handshake();
    engine.onerror?.({ message: "wasm trap" } as ErrorEvent);
    expect(onError).toHaveBeenCalledWith("wasm trap");
    expect(engine.terminated).toBe(true);
    const sentBefore = engine.sent.length;
    analyzer.analyze(START);
    expect(engine.sent).toHaveLength(sentBefore);
  });

  it("gives up if the engine never answers the handshake", () => {
    const { onError } = setup({ startTimeoutMs: 5000 });
    vi.advanceTimersByTime(4999);
    expect(onError).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("stops listening after dispose and terminates the worker", () => {
    const { engine, analyzer, updates } = setup();
    engine.handshake();
    analyzer.analyze(START);
    analyzer.dispose();
    expect(engine.terminated).toBe(true);
    engine.say("bestmove e2e4");
    expect(updates).toHaveLength(0);
    analyzer.dispose(); // idempotent
  });

  it("reports an unparseable position as having no lines", () => {
    const { engine, analyzer, updates } = setup();
    engine.handshake();
    analyzer.analyze("not a fen");
    expect(updates).toEqual([{ fen: "not a fen", lines: [], thinking: false }]);
    expect(engine.goCount).toBe(0);
  });
});
