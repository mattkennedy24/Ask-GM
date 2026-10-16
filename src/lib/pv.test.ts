import { describe, expect, it } from "vitest";
import { pvTokens } from "./pv";
import { START_FEN } from "./lines";

const text = (tokens: ReturnType<typeof pvTokens>) => tokens.map((t) => t.text).join(" ");

describe("pvTokens", () => {
  it("numbers a White-to-move line", () => {
    expect(text(pvTokens(START_FEN, ["e2e4", "e7e5", "g1f3"]))).toBe("1. e4 e5 2. Nf3");
  });

  it("opens a Black-to-move line with an ellipsis", () => {
    const afterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    expect(text(pvTokens(afterE4, ["e7e5", "g1f3", "b8c6"]))).toBe("1… e5 2. Nf3 Nc6");
  });

  it("records each move's index so the active one can be highlighted", () => {
    const moves = pvTokens(START_FEN, ["e2e4", "e7e5", "g1f3"]).filter((t) => t.kind === "move");
    expect(moves.map((t) => t.moveIndex)).toEqual([0, 1, 2]);
  });

  it("stops at the first illegal move and honours the move limit", () => {
    expect(text(pvTokens(START_FEN, ["e2e4", "e7e5", "e2e5", "g1f3"]))).toBe("1. e4 e5");
    expect(text(pvTokens(START_FEN, ["e2e4", "e7e5", "g1f3"], 2))).toBe("1. e4 e5");
  });

  it("returns nothing for an unusable position", () => {
    expect(pvTokens("garbage", ["e2e4"])).toEqual([]);
  });
});
