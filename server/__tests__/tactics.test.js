import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import {
  getBishopFacts,
  getPawnStructure,
  getPieceSafety,
  getTacticalFacts,
  getTacticalMoves,
} from "../lib/tactics.js";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function fenAfter(...sans) {
  const chess = new Chess();
  for (const san of sans) chess.move(san);
  return chess.fen();
}

describe("getPieceSafety: what can be won by capturing", () => {
  it("reports an undefended piece the side to move can take", () => {
    // White rook d1 against a Black knight on d5 that nothing protects.
    const { opportunities } = getPieceSafety("4k3/8/8/3n4/8/8/8/3RK3 w - - 0 1");
    expect(opportunities).toEqual(["Black's knight on d5 is undefended: Rxd5 wins it"]);
  });

  it("says nothing when the capture would lose material", () => {
    // The same knight, now guarded by a pawn: Rxd5 exd5 gives up a rook for a knight.
    const { opportunities } = getPieceSafety("4k3/8/4p3/3n4/8/8/8/3RK3 w - - 0 1");
    expect(opportunities).toEqual([]);
  });

  it("counts attackers and defenders, including a queen hiding behind a rook", () => {
    // d5 is guarded once (Rd8) but attacked twice along the file: Rxd5 Rxd5 Qxd5 wins a pawn,
    // and the queen only joins the exchange after the rook has gone.
    const { opportunities } = getPieceSafety("3rk3/8/8/3p4/8/8/3R4/3QK3 w - - 0 1");
    expect(opportunities).toEqual(["Black's pawn on d5 is defended, but Rxd5 still nets about 1 point"]);
  });

  it("recognises a cheap piece attacking a more valuable one", () => {
    // 1.e4 d5 2.e5 Nf6: the pawn attacks the knight, which is guarded twice, and still loses material.
    const { opportunities } = getPieceSafety(fenAfter("e4", "d5", "e5", "Nf6"));
    expect(opportunities).toEqual(["Black's knight on f6 is defended, but exf6 still nets about 2 points"]);
  });

  it("lets a king take an undefended neighbour but never a guarded one", () => {
    expect(getPieceSafety("4k3/8/8/8/8/4n3/4K3/8 w - - 0 1").opportunities).toEqual([
      "Black's knight on e3 is undefended: Kxe3 wins it",
    ]);
    // A Black pawn on d4 guards e3, so the king may not capture it.
    expect(getPieceSafety("4k3/8/8/8/3p4/4n3/4K3/8 w - - 0 1").opportunities).toEqual([]);
  });

  it("does not credit a pinned piece with a capture it cannot make", () => {
    // The Be2 is pinned to its king by the rook on e8, so Bxc4 is illegal and the pawn is not a target.
    expect(getPieceSafety("4r1k1/8/8/8/2p5/8/4B3/4K3 w - - 0 1").opportunities).toEqual([]);
  });

  it("lists the biggest prize first and caps the list", () => {
    // White queen on d4 forks an undefended rook (a4) and an undefended bishop (g7).
    const { opportunities } = getPieceSafety("4k3/6b1/8/8/r2Q4/8/8/4K3 w - - 0 1");
    expect(opportunities[0]).toMatch(/Black's rook on a4/);
    expect(opportunities[1]).toMatch(/Black's bishop on g7/);
  });

  it("warns about what the opponent would win next if the side to move does nothing", () => {
    // 1.e4 e5 2.Nf3: the e5 pawn hangs to the knight, and it is Black's move.
    const { opportunities, threats } = getPieceSafety(fenAfter("e4", "e5", "Nf3"));
    expect(opportunities).toEqual([]);
    expect(threats).toEqual(["Black's pawn on e5 is undefended: Nxe5 wins it"]);
  });

  it("finds the pressure on f7 in the Scholar's mate set-up", () => {
    const { threats } = getPieceSafety(fenAfter("e4", "e5", "Bc4", "Nc6", "Qh5"));
    expect(threats).toEqual(["Black's pawn on f7 is defended, but Bxf7+ still nets about 1 point"]);
  });

  it("reports no threats while the side to move is in check (the check comes first)", () => {
    const { threats } = getPieceSafety(fenAfter("e4", "f5", "Qh5+"));
    expect(threats).toEqual([]);
  });

  it("is quiet in the starting position and survives garbage", () => {
    expect(getPieceSafety(START_FEN)).toEqual({ opportunities: [], threats: [] });
    expect(getPieceSafety("garbage")).toEqual({ opportunities: [], threats: [] });
  });
});

describe("getPawnStructure", () => {
  it("finds a passed pawn and counts the steps to promotion for each colour", () => {
    expect(getPawnStructure("8/5k2/8/3P4/8/8/6K1/8 w - - 0 1")).toBe("White has a passed pawn on d5 (3 steps from promotion).");
    expect(getPawnStructure("8/8/8/8/2p5/8/8/4K2k b - - 0 1")).toBe("Black has a passed pawn on c4 (3 steps from promotion).");
  });

  it("does not call a pawn passed while an enemy pawn can still stop or capture it", () => {
    // Black's d7 pawn is ahead of White's e5 on an adjacent file, and vice versa for neither side.
    expect(getPawnStructure("4k3/3p4/8/4P3/8/8/8/4K3 w - - 0 1")).toBe("");
  });

  it("reports isolated and doubled pawns", () => {
    const text = getPawnStructure("4k3/8/8/8/8/P7/P6P/4K3 w - - 0 1");
    expect(text).toContain("isolated pawns on a3, a2, h2");
    expect(text).toContain("doubled pawns on the a-file");
  });

  it("does not call a lone pawn 'isolated'", () => {
    expect(getPawnStructure("8/5k2/8/3P4/8/8/6K1/8 w - - 0 1")).not.toMatch(/isolated/);
  });

  it("is empty for the starting position and for garbage", () => {
    expect(getPawnStructure(START_FEN)).toBe("");
    expect(getPawnStructure("garbage")).toBe("");
  });
});

describe("getBishopFacts", () => {
  it("notices the bishop pair, but only when just one side has it", () => {
    expect(getBishopFacts("4k3/8/8/8/8/8/8/2B1KB2 w - - 0 1")).toBe("White has the bishop pair.");
    expect(getBishopFacts("2b1kb2/8/8/8/8/8/8/2B1KB2 w - - 0 1")).toBe("");
  });

  it("notices opposite-coloured bishops", () => {
    expect(getBishopFacts("4kb2/8/8/8/8/3B4/8/4K3 w - - 0 1")).toBe("The bishops are on opposite colors.");
    // Both bishops on light squares (c8 and d3).
    expect(getBishopFacts("2b1k3/8/8/8/8/3B4/8/4K3 w - - 0 1")).toBe("");
  });
});

describe("getTacticalMoves", () => {
  it("lists the checks and captures available, mate included", () => {
    const fen = fenAfter("e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6");
    const { checks, captures } = getTacticalMoves(fen);
    expect(checks).toContain("Qxf7#");
    expect(captures).toContain("Qxf7#");
    expect(captures).toContain("Qxe5+");
  });

  it("caps long lists", () => {
    const { captures } = getTacticalMoves("4k3/8/8/8/8/p1p1p1p1/1P1P1P1P/4K3 w - - 0 1");
    expect(captures.length).toBeLessThanOrEqual(8);
  });
});

describe("getTacticalFacts", () => {
  it("returns prompt-ready bullets that name the mover and the waiting side", () => {
    const facts = getTacticalFacts(fenAfter("e4", "d5", "e5", "Nf6"));
    expect(facts).toContain("White can win material by capturing: Black's knight on f6 is defended, but exf6 still nets about 2 points.");
    expect(facts).toContain("Checks available to White: Bb5+");
    expect(facts).toContain("Captures available to White: exf6");
  });

  it("is silent once the game is over", () => {
    expect(getTacticalFacts(fenAfter("f3", "e5", "g4", "Qh4#"))).toEqual([]);
  });

  it("is silent in a quiet starting position", () => {
    expect(getTacticalFacts(START_FEN)).toEqual([]);
  });
});

describe("getPieceSafety against a brute-force search", () => {
  // The facts handed to the coach must be right, so the static exchange is checked against an independent
  // search that plays out every capture on the square with real legal moves (pins and discovered checks included).
  const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

  function bestExchange(chess, square, depth = 0) {
    // Nothing can capture here at all: no need to generate every legal move to find out.
    if (depth > 12 || chess.attackers(square, chess.turn()).length === 0) return 0;
    let best = 0;
    for (const move of chess.moves({ verbose: true })) {
      if (move.to !== square || !move.captured || move.flags.includes("e")) continue;
      chess.move(move);
      best = Math.max(best, VALUE[move.captured] - bestExchange(chess, square, depth + 1));
      chess.undo();
    }
    return best;
  }

  it("makes (almost) no claim that a real search refutes, and misses almost nothing it could have listed", { timeout: 60_000 }, () => {
    let seed = 20240607;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

    let claims = 0;
    let wrong = 0;
    let findable = 0;
    let missed = 0;
    for (let n = 0; n < 70; n++) {
      const chess = new Chess();
      const plies = 8 + Math.floor(random() * 60);
      for (let i = 0; i < plies; i++) {
        const moves = chess.moves();
        if (moves.length === 0) break;
        chess.move(moves[Math.floor(random() * moves.length)]);
      }
      if (chess.isGameOver()) continue;

      const truth = new Set();
      for (const row of chess.board()) {
        for (const piece of row) {
          if (piece && piece.color !== chess.turn() && piece.type !== "k" && bestExchange(chess, piece.square) > 0) truth.add(piece.square);
        }
      }

      const { opportunities } = getPieceSafety(chess.fen());
      const claimed = new Set(opportunities.map((text) => /on ([a-h][1-8])/.exec(text)[1]));
      for (const square of claimed) {
        claims++;
        if (!truth.has(square)) wrong++;
      }
      if (opportunities.length < 4) {
        for (const square of truth) {
          findable++;
          if (!claimed.has(square)) missed++;
        }
      }
    }

    // A small, fixed sample keeps this quick; `npm run verify:tactics` runs thousands.
    expect(claims).toBeGreaterThan(50);
    expect(wrong / claims).toBeLessThan(0.02);
    expect(missed / findable).toBeLessThan(0.03);
  });
});
