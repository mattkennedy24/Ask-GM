import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { moveKey, resolveMove } from "./chessMoves";
import { tokenizeChessText } from "./chessText";
import { evalLabel, evalSide, formatEvalValue, whiteShare } from "./evaluation";
import { buildPositions, kingInCheckSquare, moveSquares, sanUpTo, START_FEN, uciUpTo } from "./lines";
import { currentPly, goTo, INITIAL_GAME, playMove, undo } from "./game";

function fenAfter(...sans: string[]): string {
  const chess = new Chess();
  for (const san of sans) chess.move(san);
  return chess.fen();
}

describe("moveKey / resolveMove", () => {
  it("treats SAN typesetting variants as one move", () => {
    expect(moveKey("Bxe5+")).toBe("Be5");
    expect(moveKey("Nbd2")).toBe("Nd2");
    expect(moveKey("exd5")).toBe("exd5");
    expect(moveKey("e8=Q+")).toBe("e8=Q");
  });

  it("resolves a move written in prose to the one legal move", () => {
    expect(resolveMove(START_FEN, "Nf3")).toEqual({ from: "g1", to: "f3", promotion: undefined, san: "Nf3" });
    expect(resolveMove(START_FEN, "e4")).toMatchObject({ from: "e2", to: "e4" });
  });

  it("returns null for illegal or unparseable moves", () => {
    expect(resolveMove(START_FEN, "Qh5")).toBeNull();
    expect(resolveMove(START_FEN, "O-O")).toBeNull();
    expect(resolveMove("garbage", "Nf3")).toBeNull();
  });

  it("accepts a missing check symbol and honours explicit disambiguation", () => {
    // 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6 — Qxf7# is mate.
    const fen = fenAfter("e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6");
    expect(resolveMove(fen, "Qxf7")).toMatchObject({ from: "h5", to: "f7", san: "Qxf7#" });
    expect(resolveMove(fen, "Qxf7#")).toMatchObject({ san: "Qxf7#" });

    // Two knights can reach d2: "Nd2" is ambiguous, "Nbd2" is not.
    const twoKnights = fenAfter("Nf3", "Nf6", "d3", "d6");
    expect(resolveMove(twoKnights, "Nd2")).toBeNull();
    expect(resolveMove(twoKnights, "Nbd2")).toMatchObject({ from: "b1", to: "d2" });
  });
});

describe("tokenizeChessText", () => {
  const texts = (segments: ReturnType<typeof tokenizeChessText>) => segments.map((s) => s.text);
  const moves = (segments: ReturnType<typeof tokenizeChessText>) =>
    segments.filter((s) => s.kind === "move").map((s) => s.text);

  it("keeps the check symbol inside the highlighted move (the old \\b regex dropped it)", () => {
    expect(moves(tokenizeChessText("Then Qh5+ and Bxf7# follow."))).toEqual(["Qh5+", "Bxf7#"]);
    expect(moves(tokenizeChessText("Play Nf3."))).toEqual(["Nf3"]);
  });

  it("reassembles to the original text", () => {
    const text = "Open with e4, then after e5 follow with Nf3 and O-O when ready.";
    expect(texts(tokenizeChessText(text, START_FEN)).join("")).toBe(text);
  });

  it("finds castling, captures and promotions", () => {
    expect(moves(tokenizeChessText("Castle with O-O or O-O-O, take exd5, promote with e8=Q+."))).toEqual([
      "O-O",
      "O-O-O",
      "exd5",
      "e8=Q+",
    ]);
  });

  it("recognises a pawn push as a move only when it is legal and reads like a move", () => {
    const seg = tokenizeChessText("Best is e4, then d4 later.", START_FEN);
    expect(moves(seg)).toEqual(["e4", "d4"]);
    expect(seg.find((s) => s.kind === "move")).toMatchObject({ move: { from: "e2", to: "e4" } });
  });

  it("does not mistake square names for pawn moves", () => {
    const text = "Pressure on e5, the d5 square, and the e4 pawn all matter; look at h7 too.";
    expect(moves(tokenizeChessText(text, START_FEN))).toEqual([]);
  });

  it("does not treat a bare square as a move without a position", () => {
    expect(moves(tokenizeChessText("Play e4 now."))).toEqual([]);
  });

  it("marks moves playable only when they are legal in the reply's position", () => {
    const seg = tokenizeChessText("Consider Nf3, but not Qh5.", START_FEN).filter((s) => s.kind === "move");
    expect(seg.map((s) => [s.text, s.kind === "move" && s.move !== null])).toEqual([
      ["Nf3", true],
      ["Qh5", false],
    ]);
  });

  it("leaves ordinary words alone", () => {
    expect(moves(tokenizeChessText("Be careful: Black has a Bind on the King and Rooks are slow."))).toEqual([]);
  });
});

describe("evaluation helpers", () => {
  it("names the side and size of an advantage", () => {
    expect(evalLabel(0, null)).toBe("Equal");
    expect(evalLabel(24, null)).toBe("Equal");
    expect(evalLabel(60, null)).toBe("White edge");
    expect(evalLabel(-60, null)).toBe("Black edge");
    expect(evalLabel(150, null)).toBe("White better");
    expect(evalLabel(-250, null)).toBe("Black better");
    expect(evalLabel(500, null)).toBe("White winning");
    expect(evalLabel(-900, null)).toBe("Black winning");
    expect(evalLabel(9999, 4)).toBe("White mates");
    expect(evalLabel(-9999, -4)).toBe("Black mates");
    expect(evalLabel(null, null)).toBe("");
  });

  it("formats the number", () => {
    expect(formatEvalValue(35, null)).toBe("+0.35");
    expect(formatEvalValue(-120, null)).toBe("−1.20");
    expect(formatEvalValue(0, null)).toBe("0.00");
    expect(formatEvalValue(9999, 3)).toBe("M3");
    expect(formatEvalValue(-9999, -3)).toBe("−M3");
    expect(formatEvalValue(null, null)).toBe("—");
  });

  it("reports which side is ahead", () => {
    expect(evalSide(null, null)).toBeNull();
    expect(evalSide(10, null)).toBe("equal");
    expect(evalSide(80, null)).toBe("white");
    expect(evalSide(-80, null)).toBe("black");
    expect(evalSide(9999, -2)).toBe("black");
  });

  it("maps scores to a bar share that is monotonic and bounded", () => {
    expect(whiteShare(null, null)).toBe(50);
    expect(whiteShare(0, null)).toBe(50);
    expect(whiteShare(9999, 3)).toBe(97);
    expect(whiteShare(-9999, -3)).toBe(3);
    expect(whiteShare(100, null)).toBeGreaterThan(whiteShare(50, null));
    expect(whiteShare(100000, null)).toBeLessThanOrEqual(100);
    expect(whiteShare(-100000, null)).toBeGreaterThanOrEqual(0);
  });
});

describe("lines", () => {
  it("replays UCI moves into positions and stops at the first illegal move", () => {
    const plies = buildPositions(["e2e4", "e7e5", "g1f3"]);
    expect(plies.map((p) => p.san)).toEqual([null, "e4", "e5", "Nf3"]);
    expect(plies[0].fen).toBe(START_FEN);
    expect(buildPositions(["e2e4", "e2e4", "g1f3"])).toHaveLength(2);
  });

  it("derives move lists and highlight squares from a position index", () => {
    const plies = buildPositions(["e2e4", "e7e5", "g1f3"]);
    expect(sanUpTo(plies, 2)).toEqual(["e4", "e5"]);
    expect(uciUpTo(plies, 3)).toEqual(["e2e4", "e7e5", "g1f3"]);
    expect(sanUpTo(plies, 0)).toEqual([]);
    expect(moveSquares(plies[3])).toEqual({ from: "g1", to: "f3" });
    expect(moveSquares(plies[0])).toBeNull();
  });
});

describe("kingInCheckSquare", () => {
  it("finds the king of the side to move when it is in check", () => {
    expect(kingInCheckSquare(fenAfter("e4", "f5", "Qh5"))).toBe("e8");
    expect(kingInCheckSquare(fenAfter("e4", "e5", "Qh5", "Nc6", "Qxf7"))).toBe("e8");
  });

  it("returns null when there is no check, or the position is unusable", () => {
    expect(kingInCheckSquare(START_FEN)).toBeNull();
    expect(kingInCheckSquare("garbage")).toBeNull();
  });
});

describe("game state", () => {
  it("plays legal moves and rejects illegal ones", () => {
    const afterE4 = playMove(INITIAL_GAME, "e2", "e4");
    expect(afterE4?.index).toBe(1);
    expect(currentPly(afterE4!).san).toBe("e4");
    expect(playMove(INITIAL_GAME, "e2", "e5")).toBeNull();
    expect(playMove(INITIAL_GAME, "e7", "e5")).toBeNull(); // not Black's move
  });

  it("derives the last move from the position on screen, so it follows navigation", () => {
    let game = playMove(INITIAL_GAME, "e2", "e4")!;
    game = playMove(game, "e7", "e5")!;
    expect(moveSquares(currentPly(game))).toEqual({ from: "e7", to: "e5" });
    game = goTo(game, 1);
    expect(moveSquares(currentPly(game))).toEqual({ from: "e2", to: "e4" }); // the old code reset this to null
    game = goTo(game, 0);
    expect(moveSquares(currentPly(game))).toBeNull();
  });

  it("replaces the abandoned future when a move is played after stepping back", () => {
    let game = playMove(INITIAL_GAME, "e2", "e4")!;
    game = playMove(game, "e7", "e5")!;
    game = playMove(game, "g1", "f3")!;
    game = goTo(game, 1);
    game = playMove(game, "c7", "c5")!;
    expect(game.plies.map((p) => p.san)).toEqual([null, "e4", "c5"]);
    expect(game.index).toBe(2);
  });

  it("clamps navigation to the ends of the game", () => {
    const game = playMove(INITIAL_GAME, "e2", "e4")!;
    expect(goTo(game, -5).index).toBe(0);
    expect(goTo(game, 99).index).toBe(1);
  });

  it("undo takes back the move and drops the future", () => {
    let game = playMove(INITIAL_GAME, "e2", "e4")!;
    game = playMove(game, "e7", "e5")!;
    game = goTo(game, 1);
    const undone = undo(game);
    expect(undone.plies).toHaveLength(1);
    expect(undone.index).toBe(0);
    expect(undo(INITIAL_GAME)).toBe(INITIAL_GAME);
  });

  it("records promotions in UCI form", () => {
    const chess = new Chess("8/P7/8/8/8/8/7k/K7 w - - 0 1");
    const start = { plies: [{ fen: chess.fen(), san: null, uci: null }], index: 0 };
    expect(playMove(start, "a7", "a8")).toBeNull(); // promotion piece is required
    const promoted = playMove(start, "a7", "a8", "q");
    expect(currentPly(promoted!)).toMatchObject({ san: "a8=Q", uci: "a7a8q" });
  });
});
