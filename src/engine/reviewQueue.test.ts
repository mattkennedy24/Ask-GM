import { describe, expect, it, vi } from "vitest";
import { type ReviewProgress, ReviewQueue } from "./reviewQueue";

/** A queue wired to spies, with `finished` standing in for positions that are already searched. */
function setup(finished: string[] = []) {
  const started: string[] = [];
  const results: string[] = [];
  const progress: ReviewProgress[] = [];
  const stop = vi.fn();
  const done = new Set(finished);
  const queue = new ReviewQueue({
    start: (fen) => started.push(fen),
    stop,
    isDone: (fen) => done.has(fen),
    onResult: (fen) => {
      results.push(fen);
      done.add(fen);
    },
    onProgress: (p) => progress.push(p),
  });
  return { queue, started, results, progress, stop };
}

describe("ReviewQueue", () => {
  it("searches one position at a time, in order", () => {
    const { queue, started } = setup();
    queue.add(["a", "b", "c"]);
    expect(started).toEqual(["a"]);
    queue.complete("a", []);
    expect(started).toEqual(["a", "b"]);
    queue.complete("b", []);
    queue.complete("c", []); // not started yet: ignored
    expect(started).toEqual(["a", "b", "c"]);
  });

  it("skips positions that are already searched deeply enough, and duplicates", () => {
    const { queue, started } = setup(["b"]);
    queue.add(["a", "b", "a", "c"]);
    expect(started).toEqual(["a"]);
    queue.complete("a", []);
    expect(started).toEqual(["a", "c"]);
  });

  it("lets an urgent position jump ahead of the waiting ones, but not interrupt the running search", () => {
    const { queue, started } = setup();
    queue.add(["a", "b", "c"]);
    queue.add(["z"], { urgent: true });
    expect(started).toEqual(["a"]);
    queue.complete("a", []);
    expect(started).toEqual(["a", "z"]);
    queue.complete("z", []);
    expect(started).toEqual(["a", "z", "b"]);
  });

  it("moves an already-waiting position up when it becomes urgent", () => {
    const { queue, started } = setup();
    queue.add(["a", "b", "c"]);
    queue.add(["c"], { urgent: true });
    queue.complete("a", []);
    expect(started).toEqual(["a", "c"]);
  });

  it("reports every result to the owner", () => {
    const { queue, results } = setup();
    queue.add(["a", "b"]);
    queue.complete("a", [{ pv: ["e2e4"], score: 10, mate: null, depth: 14 }]);
    queue.complete("b", []);
    expect(results).toEqual(["a", "b"]);
  });

  it("counts progress for a whole-game review and says when it is over", () => {
    const { queue, progress } = setup(["done-already"]);
    queue.add(["done-already", "a", "b"], { tracked: true });
    expect(progress.at(-1)).toEqual({ running: true, done: 0, total: 2 });
    queue.complete("a", []);
    expect(progress.at(-1)).toEqual({ running: true, done: 1, total: 2 });
    queue.complete("b", []);
    expect(progress.at(-1)).toEqual({ running: false, done: 0, total: 0 });
  });

  it("does not count quiet positions towards a review's progress", () => {
    const { queue, progress } = setup();
    queue.add(["a"]);
    queue.complete("a", []);
    expect(progress).toEqual([]);
  });

  it("counts a quiet position that a review then asks for", () => {
    const { queue, progress } = setup();
    queue.add(["a", "b"]);
    queue.add(["a", "b"], { tracked: true });
    expect(progress.at(-1)).toEqual({ running: true, done: 0, total: 2 });
    queue.complete("a", []);
    queue.complete("b", []);
    expect(progress.at(-1)).toEqual({ running: false, done: 0, total: 0 });
  });

  it("cancels: stops the running search, forgets the rest and ignores a late result", () => {
    const { queue, started, results, stop, progress } = setup();
    queue.add(["a", "b", "c"], { tracked: true });
    queue.cancel();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(progress.at(-1)).toEqual({ running: false, done: 0, total: 0 });
    queue.complete("a", []);
    expect(results).toEqual([]);
    expect(started).toEqual(["a"]);
  });

  it("can be used again after finishing or cancelling", () => {
    const { queue, started } = setup();
    queue.add(["a"], { tracked: true });
    queue.cancel();
    queue.add(["b"], { tracked: true });
    expect(started).toEqual(["a", "b"]);
  });

  it("does nothing for an empty request", () => {
    const { queue, started, progress } = setup();
    queue.add([], { tracked: true });
    expect(started).toEqual([]);
    expect(progress).toEqual([]);
  });
});
