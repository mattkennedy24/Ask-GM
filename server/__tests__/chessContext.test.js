import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import {
  formatEval,
  formatPvLine,
  getFileStatus,
  getGamePhase,
  getKingSafety,
  getMaterialBalance,
} from "../lib/chessContext.js";
import { buildSystemPrompt } from "../lib/prompt.js";
import gmPersonalities from "../gmPersonalities.js";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function fenAfter(...sans) {
  const chess = new Chess();
  for (const san of sans) chess.move(san);
  return chess.fen();
}

describe("formatEval", () => {
  it("describes centipawn scores from White's point of view", () => {
    expect(formatEval(0, null)).toBe("0.00 (equal)");
    expect(formatEval(35, null)).toBe("+0.35 (White slightly better)");
    expect(formatEval(-150, null)).toBe("-1.50 (Black clearly better)");
    expect(formatEval(450, null)).toBe("+4.50 (White winning)");
  });

  it("names the side that is mating", () => {
    expect(formatEval(9999, 3)).toBe("White mates in 3");
    expect(formatEval(-9999, -2)).toBe("Black mates in 2");
  });

  it("handles a missing evaluation", () => {
    expect(formatEval(null, null)).toBe("no evaluation");
    expect(formatEval(undefined, undefined)).toBe("no evaluation");
  });
});

describe("formatPvLine", () => {
  it("numbers a White-to-move line", () => {
    expect(formatPvLine(START_FEN, ["e2e4", "e7e5", "g1f3"])).toBe("1. e4 e5 2. Nf3");
  });

  it("starts a Black-to-move line with an ellipsis", () => {
    const fen = fenAfter("e4");
    expect(formatPvLine(fen, ["e7e5", "g1f3", "b8c6"])).toBe("1... e5 2. Nf3 Nc6");
  });

  it("stops at the first illegal move instead of skipping it", () => {
    // d7d5 is legal for Black but e2e5 is not legal for White: nothing after it may be applied.
    expect(formatPvLine(START_FEN, ["e2e4", "e7e5", "e2e5", "g1f3"])).toBe("1. e4 e5");
  });

  it("converts promotions and honours maxMoves", () => {
    const fen = "8/P7/8/8/8/8/7k/K7 w - - 0 1";
    expect(formatPvLine(fen, ["a7a8q"])).toBe("1. a8=Q");
    expect(formatPvLine(START_FEN, ["e2e4", "e7e5", "g1f3"], 2)).toBe("1. e4 e5");
  });

  it("returns an empty string for an unusable position", () => {
    expect(formatPvLine("garbage", ["e2e4"])).toBe("");
  });
});

describe("position facts", () => {
  it("reports equal material at the start and the point lead afterwards", () => {
    expect(getMaterialBalance(START_FEN)).toMatch(/equal/i);
    const afterCapture = fenAfter("e4", "d5", "exd5");
    expect(getMaterialBalance(afterCapture)).toMatch(/White is ahead by 1 point/);
  });

  it("classifies the phase from non-pawn material, not pawn count", () => {
    expect(getGamePhase(START_FEN)).toBe("opening");
    expect(getGamePhase("r3k2r/pp3ppp/2n1b3/3q4/3P4/2N1B3/PP3PPP/R2QK2R w KQkq - 0 15")).toBe("middlegame");
    expect(getGamePhase("4k3/8/8/8/8/8/PPPPPPPP/R3K3 w - - 0 40")).toBe("endgame");
    // Few pawns but lots of pieces is NOT an endgame (the old pawn-count heuristic said it was).
    expect(getGamePhase("r1bq1rk1/ppp2ppp/2n2n2/3p4/3P4/2N2N2/PPP2PPP/R1BQ1RK1 w - - 0 12")).not.toBe("endgame");
  });

  it("finds open and half-open files", () => {
    expect(getFileStatus(START_FEN)).toMatch(/closed structure/);
    // White's d- and e-pawns are gone but Black's remain: those files are half-open for White.
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPP2PPP/RNBQKBNR w KQkq - 0 1";
    expect(getFileStatus(fen)).toMatch(/half-open for White: d, e/);
    // A file with no pawns at all is fully open.
    expect(getFileStatus("4k3/8/8/8/8/8/PPP1PPPP/4K3 w - - 0 1")).toMatch(/open files: d/);
  });

  it("describes king placement and remaining castling rights", () => {
    expect(getKingSafety(START_FEN)).toBe("Castling: White can castle either side; Black can castle either side.");
    expect(getKingSafety("6k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1")).toMatch(/tucked away on the kingside/);
    // Lost castling rights while still on e1: that is worth telling a student.
    const stuck = getKingSafety("4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1");
    expect(stuck).toMatch(/White's king is stuck in the center and can no longer castle/);
    expect(stuck).toMatch(/Castling: White can no longer castle; Black can no longer castle\./);
    expect(getKingSafety("r3k2r/8/8/8/4K3/8/8/8 w kq - 0 1")).toMatch(/White's king is exposed in the center/);
    expect(getKingSafety("r3k2r/8/8/8/8/8/8/R3K2R w Kk - 0 1")).toMatch(/White can still castle kingside; Black can still castle kingside/);
  });
});

describe("buildSystemPrompt", () => {
  const base = {
    gm: gmPersonalities.Magnus,
    fen: START_FEN,
    moveHistory: [],
    topLines: [{ pv: ["e2e4", "e7e5"], score: 35, mate: null, depth: 18 }],
    openingName: "",
    lengthHint: "1-2 punchy sentences",
  };

  it("grounds the persona with the position, the engine lines and the response rules", () => {
    const prompt = buildSystemPrompt(base);
    expect(prompt).toContain("You are Magnus Carlsen");
    expect(prompt).toContain(`FEN: ${START_FEN}`);
    expect(prompt).toContain("[BEST] +0.35 (White slightly better): 1. e4 e5");
    expect(prompt).toContain("depth 18");
    expect(prompt).toMatch(/White's point of view/);
    expect(prompt).toMatch(/only recommend moves that appear in these lines/i);
    expect(prompt).toMatch(/no markdown/i);
    expect(prompt).toMatch(/FOLLOWUPS:/);
    expect(prompt).toContain("1-2 punchy sentences");
  });

  it("says plainly when there is no engine analysis, instead of implying one", () => {
    const prompt = buildSystemPrompt({ ...base, topLines: [] });
    expect(prompt).toMatch(/not available yet/);
    expect(prompt).not.toMatch(/\[BEST\]/);
  });

  it("includes the move list and opening when known, and marks finished games", () => {
    const prompt = buildSystemPrompt({ ...base, moveHistory: ["e4", "e5", "Nf3"], openingName: "King's Pawn Game" });
    expect(prompt).toContain("Moves so far: 1. e4 e5 2. Nf3");
    expect(prompt).toContain("Opening: King's Pawn Game");

    const mated = fenAfter("f3", "e5", "g4", "Qh4#");
    expect(buildSystemPrompt({ ...base, fen: mated, topLines: [] })).toMatch(/game is OVER/);
  });

  it("treats the student's text as untrusted", () => {
    expect(buildSystemPrompt(base)).toMatch(/untrusted input/);
  });
});
