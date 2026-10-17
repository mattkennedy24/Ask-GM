import type { EngineLine } from "./uci";

/**
 * Positions waiting for a quiet, second look by the review engine.
 *
 * Reviewing a game means searching every position in it, one after another, without disturbing the
 * analysis of the position on screen. This keeps the order, skips positions that were already
 * searched deeply enough, lets an urgent request (the move you just played) jump the line, and
 * counts progress for a whole-game review. It knows nothing about workers: the owner starts each
 * search and reports back with `complete`.
 */

export interface ReviewProgress {
  /** A whole-game review is under way. */
  running: boolean;
  done: number;
  total: number;
}

export const IDLE_PROGRESS: ReviewProgress = { running: false, done: 0, total: 0 };

interface Job {
  fen: string;
  /** Counts towards the progress of a whole-game review. */
  tracked: boolean;
}

export interface ReviewQueueOptions {
  /** Begin searching `fen`; the owner calls `complete` when the search is over. */
  start: (fen: string) => void;
  /** Abandon the search that is running. */
  stop: () => void;
  /** Whether `fen` has been searched deeply enough already. */
  isDone: (fen: string) => boolean;
  /** Every finished search, so the caller can keep the result. */
  onResult: (fen: string, lines: EngineLine[]) => void;
  onProgress: (progress: ReviewProgress) => void;
}

export class ReviewQueue {
  private queue: Job[] = [];
  private current: Job | null = null;
  private done = 0;
  private total = 0;
  private tracking = false;
  private readonly options: ReviewQueueOptions;

  constructor(options: ReviewQueueOptions) {
    this.options = options;
  }

  /**
   * Queue positions. `tracked` ones belong to a whole-game review and count towards its progress;
   * the rest run quietly. `urgent` ones go to the front, so the move you just played is judged
   * before a long review gets to it.
   */
  add(fens: readonly string[], { tracked = false, urgent = false }: { tracked?: boolean; urgent?: boolean } = {}): void {
    const fresh: Job[] = [];
    for (const fen of new Set(fens)) {
      if (this.options.isDone(fen)) continue;
      const waiting = this.queue.find((job) => job.fen === fen);
      if (waiting) {
        // Already waiting: a tracked request upgrades it, an urgent one moves it up.
        if (tracked && !waiting.tracked) {
          waiting.tracked = true;
          this.total++;
        }
        if (urgent) {
          this.queue = [waiting, ...this.queue.filter((job) => job !== waiting)];
        }
        continue;
      }
      if (this.current?.fen === fen) {
        if (tracked && !this.current.tracked) {
          this.current.tracked = true;
          this.total++;
        }
        continue;
      }
      fresh.push({ fen, tracked });
      if (tracked) this.total++;
    }

    this.queue = urgent ? [...fresh, ...this.queue] : [...this.queue, ...fresh];
    if (tracked && this.total > 0) this.tracking = true;
    this.emit();
    this.pump();
  }

  /** The owner reports a finished search. Anything but the search we are waiting for is ignored. */
  complete(fen: string, lines: EngineLine[]): void {
    const job = this.current;
    if (!job || job.fen !== fen) return;
    this.current = null;
    this.options.onResult(fen, lines);
    if (job.tracked) this.done++;
    this.emit();
    this.pump();
  }

  /** Forget everything that is waiting and stop the search that is running. */
  cancel(): void {
    const running = this.current !== null;
    this.queue = [];
    this.current = null;
    this.done = 0;
    this.total = 0;
    this.tracking = false;
    if (running) this.options.stop();
    this.options.onProgress(IDLE_PROGRESS);
  }

  private pump(): void {
    if (this.current) return;
    const next = this.queue.shift();
    if (!next) {
      if (this.tracking) {
        // The whole-game review is finished; the next one starts counting from zero.
        this.tracking = false;
        this.done = 0;
        this.total = 0;
        this.options.onProgress(IDLE_PROGRESS);
      }
      return;
    }
    this.current = next;
    this.options.start(next.fen);
  }

  private emit(): void {
    if (this.tracking) this.options.onProgress({ running: true, done: this.done, total: this.total });
  }
}
