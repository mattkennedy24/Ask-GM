import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { INITIAL_GAME, playMove } from "./game";
import { exportPgn, importGame, MAX_IMPORT_CHARS, startsFromInitialPosition } from "./importGame";

const GAME = `[Event "Casual"]
[Site "?"]
[White "A"]
[Black "B"]
[Result "1-0"]

1. e4 {the king's pawn} e5 2. Nf3 (2. f4 exf4) 2... Nc6 3. Bb5 a6 $1 4. Bxc6 dxc6 5. O-O 1-0`;

describe("importGame: PGN", () => {
  it("loads the main line, ignoring tags, comments, variations and the result", () => {
    const result = importGame(GAME);
    if (!result.ok) throw new Error(result.error);
    expect(result.summary).toBe("Loaded a game of 5 moves.");
    expect(result.state.index).toBe(0);
    expect(result.state.plies.map((ply) => ply.san)).toEqual([null, "e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Bxc6", "dxc6", "O-O"]);
    expect(result.state.plies[1].uci).toBe("e2e4");
    // Every position follows legally from the one before it.
    const chess = new Chess();
    for (const ply of result.state.plies.slice(1)) {
      chess.move(ply.san!);
      expect(chess.fen()).toBe(ply.fen);
    }
    expect(startsFromInitialPosition(result.state)).toBe(true);
  });

  it("keeps promotions and castling in UCI", () => {
    const result = importGame("1. e4 d5 2. exd5 c6 3. dxc6 Nf6 4. cxb7 Nbd7 5. bxa8=Q Qc7 *");
    if (!result.ok) throw new Error(result.error);
    expect(result.state.plies.at(-2)?.uci).toBe("b7a8q");
  });

  it("starts from the position in a FEN tag", () => {
    const fen = "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1";
    const result = importGame(`[SetUp "1"]\n[FEN "${fen}"]\n\n1. e4 Kd7 *`);
    if (!result.ok) throw new Error(result.error);
    expect(result.state.plies[0].fen).toBe(fen);
    expect(result.state.plies.map((ply) => ply.san)).toEqual([null, "e4", "Kd7"]);
    expect(startsFromInitialPosition(result.state)).toBe(false);
  });

  it("refuses an illegal move, gibberish and a PGN with no moves", () => {
    expect(importGame("1. e4 e5 2. Ke3 *").ok).toBe(false);
    expect(importGame("hello there, how are you").ok).toBe(false);
    expect(importGame('[Event "x"]\n\n*').ok).toBe(false);
  });
});

describe("importGame: FEN", () => {
  it("loads a legal position as a one-position game", () => {
    const fen = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
    const result = importGame(`  ${fen}  `);
    if (!result.ok) throw new Error(result.error);
    expect(result.state.plies).toEqual([{ fen, san: null, uci: null }]);
    expect(result.summary).toBe("Loaded the position.");
    expect(startsFromInitialPosition(result.state)).toBe(false);
  });

  it("refuses an illegal position with a clear message", () => {
    const result = importGame("8/8/8/8/8/8/8/8 w - - 0 1");
    expect(result).toEqual({ ok: false, error: "That position is not legal. Check the FEN and try again." });
  });
});

describe("importGame: limits and empties", () => {
  it("asks for something when nothing was pasted", () => {
    expect(importGame("   ").ok).toBe(false);
  });

  it("refuses text that is far too long, without trying to parse it", () => {
    const result = importGame("1. e4 ".repeat(MAX_IMPORT_CHARS));
    expect(result).toEqual({ ok: false, error: "That is too long to be a single game." });
  });

  it("refuses a game with more moves than the board will take", () => {
    // 700 plies of knights shuffling is not a legal-length game for the importer, but each move is legal.
    const shuffle = ["Nf3", "Nf6", "Ng1", "Ng8"];
    const sans: string[] = [];
    for (let i = 0; i < 700; i++) sans.push(shuffle[i % 4]);
    const pgn = sans.map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${san}` : san)).join(" ");
    const result = importGame(pgn);
    expect(result.ok).toBe(false);
  });
});

describe("exportPgn", () => {
  it("round-trips a game", () => {
    let state = INITIAL_GAME;
    for (const [from, to] of [["e2", "e4"], ["e7", "e5"], ["g1", "f3"]] as const) state = playMove(state, from, to)!;
    const pgn = exportPgn(state);
    expect(pgn).toContain("1. e4 e5 2. Nf3");
    const again = importGame(pgn);
    if (!again.ok) throw new Error(again.error);
    expect(again.state.plies.map((ply) => ply.fen)).toEqual(state.plies.map((ply) => ply.fen));
  });

  it("includes the whole line, even the moves after the position on screen", () => {
    let state = INITIAL_GAME;
    for (const [from, to] of [["e2", "e4"], ["e7", "e5"]] as const) state = playMove(state, from, to)!;
    expect(exportPgn({ ...state, index: 0 })).toContain("1. e4 e5");
  });
});
