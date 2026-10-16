import { describe, expect, it } from "vitest";
import { MATE_SCORE, parseBestMove, parseInfoLine, toWhitePerspective, turnFromFen } from "./uci";

describe("parseInfoLine", () => {
  it("parses a typical multipv line", () => {
    const info = parseInfoLine(
      "info depth 14 seldepth 18 multipv 2 score cp 31 nodes 164187 nps 242163 hashfull 3 time 678 pv b3c2 d5c4 f1c4 a7a6",
    );
    expect(info).toEqual({
      multipv: 2,
      depth: 14,
      score: { kind: "cp", value: 31 },
      bound: null,
      pv: ["b3c2", "d5c4", "f1c4", "a7a6"],
    });
  });

  it("defaults multipv to 1 when the engine omits it", () => {
    expect(parseInfoLine("info depth 5 score cp -12 pv e2e4")?.multipv).toBe(1);
  });

  it("parses mate scores", () => {
    expect(parseInfoLine("info depth 9 multipv 1 score mate 3 pv d1h5 g6h5 f1c4")?.score).toEqual({ kind: "mate", value: 3 });
    expect(parseInfoLine("info depth 9 multipv 1 score mate -2 pv a1a2")?.score).toEqual({ kind: "mate", value: -2 });
  });

  it("flags aspiration-window bounds so callers can ignore them", () => {
    expect(parseInfoLine("info depth 12 multipv 1 score cp 80 lowerbound nodes 5 pv e2e4")?.bound).toBe("lower");
    expect(parseInfoLine("info depth 12 multipv 1 score cp -80 upperbound nodes 5 pv e2e4")?.bound).toBe("upper");
  });

  it("rejects lines without a score or a principal variation", () => {
    expect(parseInfoLine("info string classical evaluation enabled.")).toBeNull();
    expect(parseInfoLine("info depth 3 currmove e2e4 currmovenumber 1")).toBeNull();
    expect(parseInfoLine("info depth 3 score cp 10")).toBeNull();
    expect(parseInfoLine("bestmove e2e4")).toBeNull();
    expect(parseInfoLine("")).toBeNull();
  });

  it("keeps promotions and drops anything that is not a UCI move", () => {
    expect(parseInfoLine("info depth 4 score cp 900 pv a7a8q a2a3 bogus")?.pv).toEqual(["a7a8q", "a2a3"]);
  });
});

describe("toWhitePerspective", () => {
  const info = (value: number, kind: "cp" | "mate" = "cp") => ({
    multipv: 1,
    depth: 12,
    score: { kind, value },
    bound: null,
    pv: ["e2e4"],
  });

  it("keeps the score when White is to move", () => {
    expect(toWhitePerspective(info(50), "w")).toMatchObject({ score: 50, mate: null, depth: 12 });
  });

  it("flips the score when Black is to move — the engine reports from the mover's side", () => {
    expect(toWhitePerspective(info(50), "b")).toMatchObject({ score: -50, mate: null });
    expect(toWhitePerspective(info(-120), "b")).toMatchObject({ score: 120 });
  });

  it("flips mate distances and uses the sentinel score", () => {
    expect(toWhitePerspective(info(3, "mate"), "w")).toMatchObject({ mate: 3, score: MATE_SCORE });
    expect(toWhitePerspective(info(3, "mate"), "b")).toMatchObject({ mate: -3, score: -MATE_SCORE });
    expect(toWhitePerspective(info(-2, "mate"), "b")).toMatchObject({ mate: 2, score: MATE_SCORE });
  });
});

describe("parseBestMove / turnFromFen", () => {
  it("extracts the move and ignores ponder", () => {
    expect(parseBestMove("bestmove e2e4 ponder e7e5")).toBe("e2e4");
    expect(parseBestMove("bestmove e7e8q")).toBe("e7e8q");
  });

  it("returns null when there is no move", () => {
    expect(parseBestMove("bestmove (none)")).toBeNull();
    expect(parseBestMove("bestmove")).toBeNull();
    expect(parseBestMove("info depth 1")).toBeNull();
  });

  it("reads the side to move", () => {
    expect(turnFromFen("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1")).toBe("b");
    expect(turnFromFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")).toBe("w");
    expect(turnFromFen("garbage")).toBe("w");
  });
});
