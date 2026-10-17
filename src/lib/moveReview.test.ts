import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { MATE_SCORE, type EngineLine } from "../engine/uci";
import {
  EvalBook,
  MIN_REVIEW_DEPTH,
  formatLoss,
  preferredSan,
  reviewMove,
  verdictGlyph,
  verdictLabel,
  winChance,
} from "./moveReview";

const START = new Chess().fen();

function after(fen: string, uci: string): string {
  const chess = new Chess(fen);
  chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  return chess.fen();
}

const line = (score: number, depth: number, best = "e2e4"): EngineLine => ({ pv: [best], score, mate: null, depth });

/** A book that already knows the evaluation of two positions. */
function bookWith(entries: [string, EngineLine][]): EvalBook {
  const book = new EvalBook();
  for (const [fen, top] of entries) book.record(fen, [top]);
  return book;
}

describe("winChance", () => {
  it("is zero when equal, symmetric, and saturates for mates", () => {
    expect(winChance(0)).toBe(0);
    expect(winChance(150)).toBeCloseTo(-winChance(-150), 10);
    expect(winChance(MATE_SCORE)).toBeGreaterThan(0.999);
    expect(winChance(-MATE_SCORE)).toBeLessThan(-0.999);
  });

  it("makes a pawn matter more in an equal position than in a won one", () => {
    const nearEqual = winChance(100) - winChance(0);
    const alreadyWon = winChance(900) - winChance(800);
    expect(nearEqual).toBeGreaterThan(alreadyWon * 5);
  });
});

describe("EvalBook", () => {
  it("keeps the deepest evaluation and reports when it learned something", () => {
    const book = new EvalBook();
    expect(book.record(START, [line(20, 10)])).toBe(true);
    expect(book.record(START, [line(25, 8)])).toBe(false);
    expect(book.record(START, [line(18, 10)])).toBe(false);
    expect(book.record(START, [line(30, 16)])).toBe(true);
    expect(book.lookup(START)).toEqual({ score: 30, depth: 16, bestMove: "e2e4" });
  });

  it("shares an evaluation between transpositions that differ only in move counters", () => {
    const book = new EvalBook();
    book.record("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", [line(20, 14)]);
    expect(book.lookup("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 7 9")).not.toBeNull();
  });

  it("ignores lines that carry no score or no depth, and unknown positions", () => {
    const book = new EvalBook();
    expect(book.record(START, [])).toBe(false);
    expect(book.record(START, [{ pv: ["e2e4"], score: null, mate: null, depth: 12 }])).toBe(false);
    expect(book.record(START, [{ pv: ["e2e4"], score: 10, mate: null }])).toBe(false);
    expect(book.lookup(START)).toBeNull();
  });

  it("knows how finished games score without asking the engine", () => {
    const book = new EvalBook();
    const foolsMate = new Chess();
    for (const san of ["f3", "e5", "g4", "Qh4#"]) foolsMate.move(san);
    expect(book.lookup(foolsMate.fen())?.score).toBe(-MATE_SCORE);
    expect(book.lookup("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")?.score).toBe(0);
    expect(book.lookup("8/8/8/4k3/8/3K4/8/8 w - - 0 1")?.score).toBe(0);
  });
});

describe("reviewMove", () => {
  const e4 = after(START, "e2e4");
  const f3 = after(START, "f2f3");

  it("gives no verdict until both positions are known and searched deeply enough", () => {
    expect(reviewMove(new EvalBook(), START, e4, "e2e4")).toBeNull();
    expect(reviewMove(bookWith([[START, line(20, 14)]]), START, e4, "e2e4")).toBeNull();
    const shallow = bookWith([[START, line(20, MIN_REVIEW_DEPTH - 1)], [e4, line(20, 14)]]);
    expect(reviewMove(shallow, START, e4, "e2e4")).toBeNull();
  });

  it("calls the engine's own choice the best move", () => {
    const book = bookWith([[START, line(20, 16, "e2e4")], [e4, line(25, 16)]]);
    expect(reviewMove(book, START, e4, "e2e4")).toEqual({ quality: "best", lossCp: 0, bestMove: "e2e4" });
  });

  it("calls an alternative that loses nothing a good move, and remembers the engine's preference", () => {
    const book = bookWith([[START, line(20, 16, "e2e4")], [f3, line(15, 16)]]);
    expect(reviewMove(book, START, f3, "f2f3")).toEqual({ quality: "good", lossCp: 5, bestMove: "e2e4" });
  });

  it.each([
    [-70, "inaccuracy"],
    [-130, "mistake"],
    [-200, "blunder"],
    [-30, "good"],
  ] as const)("grades a drop from equal to %i centipawns as %s", (scoreAfter, expected) => {
    const book = bookWith([[START, line(0, 16, "g1f3")], [f3, line(scoreAfter, 16)]]);
    expect(reviewMove(book, START, f3, "f2f3")?.quality).toBe(expected);
  });

  it("measures from the side that moved: a Black move that helps White is the mistake", () => {
    const afterE4 = e4;
    const afterE4E5 = after(e4, "e7e5");
    const afterE4A5 = after(e4, "a7a5");
    // Black to move at +20 for White; ...a5 lets White's edge grow to +200, ...e5 keeps it.
    const bad = bookWith([[afterE4, line(20, 16, "e7e5")], [afterE4A5, line(200, 16)]]);
    expect(reviewMove(bad, afterE4, afterE4A5, "a7a5")?.quality).toBe("blunder");
    const fine = bookWith([[afterE4, line(20, 16, "e7e5")], [afterE4E5, line(20, 16)]]);
    expect(reviewMove(fine, afterE4, afterE4E5, "e7e5")?.quality).toBe("best");
  });

  it("treats throwing away a forced mate as a blunder", () => {
    const missed: EngineLine = { pv: ["f2f3"], score: MATE_SCORE, mate: 3, depth: 18 };
    const book = bookWith([[START, missed], [e4, line(150, 16)]]);
    const verdict = reviewMove(book, START, e4, "e2e4");
    expect(verdict?.quality).toBe("blunder");
    expect(verdict?.lossCp).toBeGreaterThan(1000);
  });

  it("treats stumbling into stalemate from a winning position as a blunder", () => {
    const winning = "7k/8/6K1/8/8/8/8/5Q2 w - - 0 1";
    const stalemate = after(winning, "f1f7");
    expect(new Chess(stalemate).isStalemate()).toBe(true);
    const book = bookWith([[winning, line(1500, 16, "f1a1")]]);
    expect(reviewMove(book, winning, stalemate, "f1f7")?.quality).toBe("blunder");
  });

  it("does not punish delivering checkmate", () => {
    const game = new Chess();
    for (const san of ["f3", "e5", "g4"]) game.move(san);
    const beforeMate = game.fen();
    const mated = after(beforeMate, "d8h4");
    const book = bookWith([[beforeMate, { pv: ["d8h4"], score: -MATE_SCORE, mate: -1, depth: 20 }]]);
    expect(reviewMove(book, beforeMate, mated, "d8h4")?.quality).toBe("best");
  });
});

describe("presentation helpers", () => {
  it("uses the chess-book marks for the three bad grades only", () => {
    expect(verdictGlyph("inaccuracy")).toBe("?!");
    expect(verdictGlyph("mistake")).toBe("?");
    expect(verdictGlyph("blunder")).toBe("??");
    expect(verdictGlyph("good")).toBe("");
    expect(verdictGlyph("best")).toBe("");
    expect(verdictLabel("blunder")).toBe("Blunder");
  });

  it("converts the engine's preferred move to SAN in the position before the move", () => {
    expect(preferredSan(START, { quality: "mistake", lossCp: 150, bestMove: "g1f3" }, "f2f3")).toBe("Nf3");
    expect(preferredSan(START, { quality: "best", lossCp: 0, bestMove: "e2e4" }, "e2e4")).toBeNull();
    expect(preferredSan(START, { quality: "mistake", lossCp: 150, bestMove: "e7e5" }, "f2f3")).toBeNull();
    expect(preferredSan(START, { quality: "mistake", lossCp: 150, bestMove: null }, "f2f3")).toBeNull();
  });

  it("prints the size of a loss in pawns and caps a missed mate", () => {
    expect(formatLoss(183)).toBe("1.8");
    expect(formatLoss(60)).toBe("0.6");
    expect(formatLoss(9999)).toBe("10+");
  });
});
