import { describe, expect, it } from "vitest";
import type { MoveQuality, MoveVerdict } from "./moveReview";
import { describeSide, nextCritical, reviewedMoves, summarizeReview } from "./reviewSummary";

const v = (quality: MoveQuality, lossCp = 0, bestMove: string | null = null): MoveVerdict => ({ quality, lossCp, bestMove });

describe("summarizeReview", () => {
  it("counts each side's mistakes and lists the plies to revisit", () => {
    // plies: 1 W best, 2 B blunder, 3 W good, 4 B inaccuracy, 5 W mistake, 6 (unknown)
    const summary = summarizeReview([v("best"), v("blunder", 400), v("good"), v("inaccuracy", 60), v("mistake", 150), null]);
    expect(summary.white).toEqual({ judged: 3, inaccuracy: 0, mistake: 1, blunder: 0 });
    expect(summary.black).toEqual({ judged: 2, inaccuracy: 1, mistake: 0, blunder: 1 });
    expect(summary.critical).toEqual([2, 4, 5]);
  });

  it("is empty for a game with no verdicts", () => {
    expect(summarizeReview([])).toEqual({
      white: { judged: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
      black: { judged: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
      critical: [],
    });
  });
});

describe("describeSide", () => {
  it("puts the worst first and pluralises properly", () => {
    expect(describeSide({ judged: 9, inaccuracy: 2, mistake: 1, blunder: 1 })).toBe("1 blunder, 1 mistake, 2 inaccuracies");
    expect(describeSide({ judged: 9, inaccuracy: 1, mistake: 2, blunder: 0 })).toBe("2 mistakes, 1 inaccuracy");
  });

  it("says so when a side played cleanly, or was not judged", () => {
    expect(describeSide({ judged: 6, inaccuracy: 0, mistake: 0, blunder: 0 })).toBe("no mistakes");
    expect(describeSide({ judged: 0, inaccuracy: 0, mistake: 0, blunder: 0 })).toBe("not judged");
  });
});

describe("nextCritical", () => {
  it("moves forward through the flagged plies and wraps round", () => {
    expect(nextCritical([2, 4, 9], 0)).toBe(2);
    expect(nextCritical([2, 4, 9], 2)).toBe(4);
    expect(nextCritical([2, 4, 9], 5)).toBe(9);
    expect(nextCritical([2, 4, 9], 9)).toBe(2);
  });

  it("returns null when nothing was flagged", () => {
    expect(nextCritical([], 3)).toBeNull();
  });
});

describe("reviewedMoves", () => {
  const verdicts = [v("best"), v("blunder", 400, "d7d5"), v("mistake", 150, "g1f3"), v("inaccuracy", 60), v("good"), v("blunder", 900, "e2e4")];

  it("tells the coach about flagged moves up to the position on screen, in game order", () => {
    expect(reviewedMoves(verdicts, 4)).toEqual([
      { ply: 2, quality: "blunder", lossCp: 400, bestMove: "d7d5" },
      { ply: 3, quality: "mistake", lossCp: 150, bestMove: "g1f3" },
      { ply: 4, quality: "inaccuracy", lossCp: 60, bestMove: null },
    ]);
  });

  it("leaves out moves the board has not reached yet", () => {
    expect(reviewedMoves(verdicts, 1)).toEqual([]);
    expect(reviewedMoves(verdicts, 6).map((m) => m.ply)).toEqual([2, 3, 4, 6]);
  });

  it("keeps only the ten costliest when there are more", () => {
    const many = Array.from({ length: 30 }, (_, i) => v("mistake", 100 + i));
    const kept = reviewedMoves(many, 30);
    expect(kept).toHaveLength(10);
    expect(Math.min(...kept.map((m) => m.lossCp))).toBe(120);
    expect(kept.map((m) => m.ply)).toEqual([...kept.map((m) => m.ply)].sort((a, b) => a - b));
  });
});
