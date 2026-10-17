import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { summarizeMaterial } from "./material";

function fenAfter(...sans: string[]): string {
  const chess = new Chess();
  for (const san of sans) chess.move(san);
  return chess.fen();
}

describe("summarizeMaterial", () => {
  it("reports nothing captured and equal material at the start", () => {
    expect(summarizeMaterial(new Chess().fen())).toEqual({ capturedByWhite: [], capturedByBlack: [], advantage: 0 });
  });

  it("tracks captures and the point lead", () => {
    const summary = summarizeMaterial(fenAfter("e4", "d5", "exd5"));
    expect(summary.capturedByWhite).toEqual(["p"]);
    expect(summary.capturedByBlack).toEqual([]);
    expect(summary.advantage).toBe(1);
  });

  it("orders captured pieces heaviest first", () => {
    // 1.e4 d5 2.exd5 Qxd5 3.Nc3 Qxg2 4.Nf3 Qxh1 — Black has taken two pawns and a rook; White one pawn.
    const summary = summarizeMaterial(fenAfter("e4", "d5", "exd5", "Qxd5", "Nc3", "Qxg2", "Nf3", "Qxh1"));
    expect(summary.capturedByBlack).toEqual(["r", "p", "p"]);
    expect(summary.capturedByWhite).toEqual(["p"]);
  });

  it("does not count a promoted pawn as a capture (the old FEN counting did)", () => {
    // The h-pawn has become a second White queen (on e4); nothing has been captured from White.
    const fen = "rnbqkbnr/pppppppp/8/8/4Q3/8/PPPPPPP1/RNBQKBNR w KQkq - 0 1";
    const summary = summarizeMaterial(fen);
    expect(summary.capturedByBlack).toEqual([]); // the missing pawn is not a capture: it became the queen
    expect(summary.advantage).toBe(8); // +9 for the extra queen, -1 for the pawn it came from
  });

  it("copes with an unusable position", () => {
    expect(summarizeMaterial("garbage")).toEqual({ capturedByWhite: [], capturedByBlack: [], advantage: 0 });
  });
});
