import { Chess } from "chess.js";
import { type EngineLine, parseBestMove, parseInfoLine, toWhitePerspective } from "./uci";

/** The slice of the Worker API the analyzer uses — a real `Worker` satisfies it, and tests drive it with a fake. */
export interface WorkerLike {
  postMessage(message: string): void;
  terminate(): void;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

export interface AnalyzerUpdate {
  /** The position these lines belong to. */
  fen: string;
  lines: EngineLine[];
  /** True while the search for `fen` is still running. */
  thinking: boolean;
}

export interface AnalyzerHandlers {
  onReady?: () => void;
  onUpdate: (update: AnalyzerUpdate) => void;
  onError: (message: string) => void;
}

export interface AnalyzerOptions {
  multiPv?: number;
  maxDepth?: number;
  moveTimeMs?: number;
  hashMb?: number;
  /** Don't publish lines shallower than this while searching (they flicker wildly). */
  minDepth?: number;
  /** Minimum gap between published updates while searching. */
  throttleMs?: number;
  /** How long to wait for the engine to answer `uci`/`isready` before giving up. */
  startTimeoutMs?: number;
  now?: () => number;
}

/** Lines requested per position. */
export const MULTI_PV = 3;

type Phase = "starting" | "idle" | "searching" | "stopping" | "disposed" | "failed";

interface Job {
  fen: string;
  turn: "w" | "b";
  /** How many lines a complete iteration contains (MultiPV, or fewer when few moves are legal). */
  expected: number;
}

const DEFAULTS = {
  multiPv: MULTI_PV,
  maxDepth: 20,
  moveTimeMs: 3000,
  hashMb: 32,
  minDepth: 8,
  throttleMs: 150,
  startTimeoutMs: 20_000,
};

/**
 * Drives one single-threaded UCI engine through a stream of position requests.
 *
 * The important property: there is only ever one search in flight, and a stale
 * `bestmove` is never mistaken for the answer to a newer position. When a new
 * position arrives mid-search we send `stop`, wait for the old search's
 * `bestmove` (which belongs to the OLD position), discard it, and only then
 * start the newest request. Requests that arrive while stopping replace each
 * other, so rapid navigation costs one search, not one per click.
 */
export class UciAnalyzer {
  private phase: Phase = "starting";
  private job: Job | null = null;
  private pending: Job | null = null;
  private readonly lines = new Map<number, EngineLine>();
  private lastEmit = 0;
  private startTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly opts: typeof DEFAULTS & { now: () => number };
  private readonly worker: WorkerLike;
  private readonly handlers: AnalyzerHandlers;

  constructor(worker: WorkerLike, handlers: AnalyzerHandlers, options: AnalyzerOptions = {}) {
    this.worker = worker;
    this.handlers = handlers;
    this.opts = { ...DEFAULTS, ...options, now: options.now ?? (() => Date.now()) };
    worker.onmessage = (event) => this.handleLine(typeof event.data === "string" ? event.data : "");
    worker.onerror = (event) => this.fail(event.message || "The engine crashed.");
    this.startTimer = setTimeout(() => this.fail("The engine did not start in time."), this.opts.startTimeoutMs);
    worker.postMessage("uci");
  }

  get isReady(): boolean {
    return this.phase === "idle" || this.phase === "searching" || this.phase === "stopping";
  }

  /** Analyse `fen`, replacing whatever was running or queued. */
  analyze(fen: string): void {
    if (this.phase === "disposed" || this.phase === "failed") return;

    let chess: Chess;
    try {
      chess = new Chess(fen);
    } catch {
      this.cancelCurrent();
      this.handlers.onUpdate({ fen, lines: [], thinking: false });
      return;
    }

    const legalMoves = chess.moves().length;
    if (legalMoves === 0) {
      // Checkmate or stalemate: nothing to search.
      this.cancelCurrent();
      this.handlers.onUpdate({ fen, lines: [], thinking: false });
      return;
    }

    // Already searching (or about to search) exactly this position.
    if (this.phase === "searching" && this.job?.fen === fen && !this.pending) return;
    if (this.pending?.fen === fen) return;

    this.pending = { fen, turn: chess.turn(), expected: Math.min(this.opts.multiPv, legalMoves) };

    if (this.phase === "idle") this.startPending();
    else if (this.phase === "searching") this.stopSearch();
    // "starting": picked up on readyok. "stopping": picked up when the old bestmove arrives.
  }

  dispose(): void {
    if (this.phase === "disposed") return;
    this.phase = "disposed";
    this.clearStartTimer();
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.terminate();
  }

  // ── internals ──────────────────────────────────────────────────────

  private handleLine(line: string): void {
    if (this.phase === "disposed" || this.phase === "failed") return;

    if (line === "uciok") {
      this.worker.postMessage(`setoption name MultiPV value ${this.opts.multiPv}`);
      this.worker.postMessage(`setoption name Hash value ${this.opts.hashMb}`);
      this.worker.postMessage("isready");
    } else if (line === "readyok") {
      if (this.phase !== "starting") return;
      this.clearStartTimer();
      this.phase = "idle";
      this.handlers.onReady?.();
      if (this.pending) this.startPending();
    } else if (line.startsWith("info ")) {
      this.handleInfo(line);
    } else if (line.startsWith("bestmove")) {
      this.handleBestMove(line);
    }
  }

  private handleInfo(line: string): void {
    if (this.phase !== "searching" || !this.job) return;
    const info = parseInfoLine(line);
    // Skip aspiration-window bounds: they are not real evaluations.
    if (!info || info.bound) return;

    this.lines.set(info.multipv, toWhitePerspective(info, this.job.turn));

    // A full iteration has arrived once the last expected line is in.
    if (info.multipv === this.job.expected && info.depth >= this.opts.minDepth) {
      const now = this.opts.now();
      if (now - this.lastEmit >= this.opts.throttleMs) {
        this.lastEmit = now;
        this.publish(this.job.fen, true);
      }
    }
  }

  private handleBestMove(line: string): void {
    const finished = this.job;
    const wasSearching = this.phase === "searching";
    this.phase = "idle";
    this.job = null;

    // A newer position is waiting: whatever just finished is stale, drop it.
    if (this.pending) {
      this.startPending();
      return;
    }
    if (!wasSearching || !finished) return;

    if (this.lines.size === 0) {
      const move = parseBestMove(line);
      if (move) this.lines.set(1, { pv: [move], score: null, mate: null });
    }
    this.publish(finished.fen, false);
  }

  private startPending(): void {
    const job = this.pending;
    if (!job) return;
    this.pending = null;
    this.job = job;
    this.lines.clear();
    this.lastEmit = 0;
    this.phase = "searching";
    this.worker.postMessage(`position fen ${job.fen}`);
    this.worker.postMessage(`go depth ${this.opts.maxDepth} movetime ${this.opts.moveTimeMs}`);
  }

  private stopSearch(): void {
    this.phase = "stopping";
    this.worker.postMessage("stop");
  }

  /** Abandon the running search and any queued request without publishing anything for them. */
  private cancelCurrent(): void {
    this.pending = null;
    if (this.phase === "searching") this.stopSearch();
  }

  private publish(fen: string, thinking: boolean): void {
    const lines = [...this.lines.entries()].sort(([a], [b]) => a - b).map(([, line]) => line);
    this.handlers.onUpdate({ fen, lines, thinking });
  }

  private fail(message: string): void {
    if (this.phase === "disposed" || this.phase === "failed") return;
    this.phase = "failed";
    this.clearStartTimer();
    this.worker.terminate();
    this.handlers.onError(message);
  }

  private clearStartTimer(): void {
    if (this.startTimer) clearTimeout(this.startTimer);
    this.startTimer = null;
  }
}
