import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { describeOutcome, gameOutcome, outcomeDetail, outcomeHeadline, outcomeNotation, outcomeWhiteShare } from "./outcome";

function fenAfter(...sans: string[]): string {
  const chess = new Chess();
  for (const san of sans) chess.move(san);
  return chess.fen();
}

describe("gameOutcome", () => {
  it("is null while the game is going on", () => {
    expect(gameOutcome(new Chess().fen())).toBeNull();
    expect(gameOutcome(fenAfter("e4", "e5", "Nf3"))).toBeNull();
  });

  it("names the winner of a checkmate", () => {
    // Fool's mate: Black mates White.
    expect(gameOutcome(fenAfter("f3", "e5", "g4", "Qh4#"))).toEqual({ kind: "checkmate", winner: "black" });
    // Scholar's mate: White mates Black.
    expect(gameOutcome(fenAfter("e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"))).toEqual({ kind: "checkmate", winner: "white" });
  });

  it("recognises stalemate, insufficient material and the fifty-move rule", () => {
    expect(gameOutcome("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")).toEqual({ kind: "stalemate" });
    expect(gameOutcome("8/8/8/4k3/8/3K4/8/8 w - - 0 1")).toEqual({ kind: "draw", reason: "insufficient material" });
    expect(gameOutcome("8/8/8/4k3/8/3K4/R7/8 w - - 100 80")).toEqual({ kind: "draw", reason: "the fifty-move rule" });
  });

  it("returns null for an unusable position", () => {
    expect(gameOutcome("garbage")).toBeNull();
  });
});

describe("describeOutcome / outcomeWhiteShare", () => {
  it("writes a readable headline", () => {
    expect(describeOutcome({ kind: "checkmate", winner: "white" })).toBe("Checkmate · White wins");
    expect(describeOutcome({ kind: "checkmate", winner: "black" })).toBe("Checkmate · Black wins");
    expect(describeOutcome({ kind: "stalemate" })).toBe("Stalemate · draw");
    expect(describeOutcome({ kind: "draw", reason: "insufficient material" })).toBe("Draw · insufficient material");
  });

  it("fills the evaluation bar for the winner, and splits it for a draw", () => {
    expect(outcomeWhiteShare({ kind: "checkmate", winner: "white" })).toBe(100);
    expect(outcomeWhiteShare({ kind: "checkmate", winner: "black" })).toBe(0);
    expect(outcomeWhiteShare({ kind: "stalemate" })).toBe(50);
  });
});

describe("result wording", () => {
  it("writes the result the way a scoresheet does", () => {
    expect(outcomeNotation({ kind: "checkmate", winner: "white" })).toBe("1\u20130");
    expect(outcomeNotation({ kind: "checkmate", winner: "black" })).toBe("0\u20131");
    expect(outcomeNotation({ kind: "stalemate" })).toBe("\u00bd\u2013\u00bd");
    expect(outcomeNotation({ kind: "draw", reason: "the fifty-move rule" })).toBe("\u00bd\u2013\u00bd");
  });

  it("gives each ending a headline and a plain sentence", () => {
    expect(outcomeHeadline({ kind: "checkmate", winner: "black" })).toBe("Checkmate");
    expect(outcomeHeadline({ kind: "stalemate" })).toBe("Stalemate");
    expect(outcomeHeadline({ kind: "draw", reason: "insufficient material" })).toBe("Draw");
    expect(outcomeDetail({ kind: "checkmate", winner: "black" })).toBe("Black wins.");
    expect(outcomeDetail({ kind: "stalemate" })).toMatch(/no legal move/i);
    expect(outcomeDetail({ kind: "draw", reason: "insufficient material" })).toMatch(/material/);
    expect(outcomeDetail({ kind: "draw", reason: "the fifty-move rule" })).toMatch(/fifty/i);
  });
});
