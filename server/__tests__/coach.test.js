import { describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import { createCoach, EmptyResponseError } from "../lib/coach.js";
import gmPersonalities from "../gmPersonalities.js";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function reply(text, stop_reason = "end_turn") {
  return { content: [{ type: "text", text }], stop_reason };
}

function makeCoach(...responses) {
  const create = vi.fn();
  for (const r of responses) {
    if (r instanceof Error) create.mockRejectedValueOnce(r);
    else create.mockResolvedValueOnce(r);
  }
  const logger = { warn: vi.fn(), error: vi.fn() };
  const coach = createCoach({
    anthropic: { messages: { create } },
    model: "test-model",
    personalities: gmPersonalities,
    logger,
    random: () => 0,
  });
  return { coach, create, logger };
}

const input = (overrides = {}) => ({
  selectedGM: "Magnus",
  fen: START_FEN,
  question: "Best move?",
  history: [],
  moveHistory: [],
  topLines: [{ pv: ["e2e4", "e7e5", "g1f3"], score: 30, mate: null, depth: 16 }],
  openingName: "",
  ...overrides,
});

describe("createCoach.ask", () => {
  it("returns plain text and follow-ups, and sends a well-formed request", async () => {
    const { coach, create } = makeCoach(reply("e4, obviously.\nFOLLOWUPS: Why e4? | What next? | Any traps?"));
    const history = [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello." },
    ];

    const result = await coach.ask(input({ history }));

    expect(result).toEqual({ response: "e4, obviously.", followUps: ["Why e4?", "What next?", "Any traps?"] });
    const request = create.mock.calls[0][0];
    expect(request.model).toBe("test-model");
    expect(request.max_tokens).toBe(8000);
    expect(request.output_config).toEqual({ effort: "high" });
    expect(request.system).toContain("You are Magnus Carlsen");
    expect(request.system).toContain(START_FEN);
    expect(request.messages).toEqual([...history, { role: "user", content: "Best move?" }]);
  });

  it("strips markdown from the model's reply", async () => {
    const { coach } = makeCoach(reply("## Plan\n**Play e4** now.\n- it is best\nFOLLOWUPS: A idea | B idea | C idea"));
    const { response } = await coach.ask(input());
    expect(response).toBe("Plan\nPlay e4 now.\nit is best");
  });

  it("cleans markdown and emoji out of the follow-up chips as well", async () => {
    const { coach } = makeCoach(reply("Develop.\nFOLLOWUPS: **Why Nf3?** \u{1F914} | What about e5? | ok"));
    const { followUps } = await coach.ask(input());
    expect(followUps).toEqual(["Why Nf3?", "What about e5?"]);
  });

  it("removes emoji from the reply itself", async () => {
    const { coach } = makeCoach(reply("Play e4 \u{1F525}\nFOLLOWUPS: A idea | B idea | C idea"));
    expect((await coach.ask(input())).response).toBe("Play e4");
  });

  it("puts the engine's review of the last move into the prompt, and the preferred move is not flagged as invented", async () => {
    // 1.f3 was a mistake; the engine preferred 1.e4, which is legal one ply back but not any more.
    const { coach, create } = makeCoach(reply("That was loose; e4 first. I would have played 1.e4.\nFOLLOWUPS: A idea | B idea | C idea"));
    const fen = "rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR b KQkq - 0 1";
    await coach.ask(input({ fen, question: "Was my move bad?", moveHistory: ["f3"], moveReview: { quality: "mistake", lossCp: 183, bestMove: "e2e4" } }));
    expect(create).toHaveBeenCalledTimes(1); // no corrective retry
    expect(create.mock.calls[0][0].system).toContain("LAST MOVE REVIEW (from the engine): White's last move, 1.f3, was a mistake");
  });

  it("lets the coach quote what the engine preferred many moves ago, without a corrective retry", async () => {
    // 1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 h6 7.Bh4 b6 8.cxd5 Nxd5 9.Bxe7 Qxe7 10.Nxd5 exd5.
    // At move 1 the engine "preferred" 1.e4; that move is long gone, but it is a fair thing to quote.
    const history = ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7", "e3", "O-O", "Nf3", "h6", "Bh4", "b6", "cxd5", "Nxd5", "Bxe7", "Qxe7", "Nxd5", "exd5"];
    const board = new Chess();
    for (const san of history) board.move(san);
    const { coach, create } = makeCoach(reply("Back at move 1 the engine liked e4 better.\nFOLLOWUPS: A idea | B idea | C idea"));
    await coach.ask(
      input({
        fen: board.fen(),
        topLines: [],
        moveHistory: history,
        question: "What were my biggest mistakes?",
        gameReview: [{ ply: 1, quality: "inaccuracy", lossCp: 60, bestMove: "e2e4" }],
      }),
    );
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].system).toContain("1.d4 (inaccuracy, gave up about 0.6 pawns; the engine preferred 1.e4)");
  });

  it("tells the model the game is over instead of pretending the engine is still thinking", async () => {
    const { coach, create } = makeCoach(reply("Brutal, wasn't it.\nFOLLOWUPS: A idea | B idea | C idea"));
    const fen = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
    await coach.ask(input({ fen, topLines: [], moveHistory: ["f3", "e5", "g4", "Qh4#"], question: "What happened?" }));
    const { system } = create.mock.calls[0][0];
    expect(system).toMatch(/GAME OVER\. Checkmate: Black has won/);
    expect(system).toMatch(/Do not recommend a move for either side/);
  });

  it("short-circuits blatant off-topic requests without calling the model", async () => {
    const { coach, create } = makeCoach();
    const result = await coach.ask(input({ question: "write a python script to sort a list" }));
    expect(create).not.toHaveBeenCalled();
    expect(result.offTopic).toBe(true);
    expect(result.response).toMatch(/wasting my time/i);
    expect(result.followUps.length).toBeGreaterThan(0);
  });

  it("does not retry when the reply only uses moves from the position and the engine lines", async () => {
    const { coach, create } = makeCoach(reply("Open with e4, then after e5 follow with Nf3.\nFOLLOWUPS: A idea | B idea | C idea"));
    await coach.ask(input());
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("retries exactly once, with a correction, when the reply names an impossible move", async () => {
    const { coach, create, logger } = makeCoach(
      reply("Play Qh8 right away.\nFOLLOWUPS: A idea | B idea | C idea"),
      reply("Play e4 instead.\nFOLLOWUPS: D idea | E idea | F idea"),
    );

    const result = await coach.ask(input());

    expect(create).toHaveBeenCalledTimes(2);
    const retry = create.mock.calls[1][0].messages;
    expect(retry.at(-2)).toEqual({ role: "assistant", content: "Play Qh8 right away." });
    expect(retry.at(-1).role).toBe("user");
    expect(retry.at(-1).content).toContain("Qh8");
    expect(result).toEqual({ response: "Play e4 instead.", followUps: ["D idea", "E idea", "F idea"] });
    expect(logger.warn).toHaveBeenCalled();
  });

  it("keeps the first reply if the corrective retry fails", async () => {
    const { coach } = makeCoach(reply("Play Qh8.\nFOLLOWUPS: A idea | B idea | C idea"), new Error("boom"));
    const result = await coach.ask(input());
    expect(result.response).toBe("Play Qh8.");
  });

  it("keeps the first reply if the retry is no better", async () => {
    const { coach } = makeCoach(reply("Play Qh8.\nFOLLOWUPS: A idea | B idea"), reply("Play Qh8 and Qh7.\nFOLLOWUPS: C idea | D idea"));
    const result = await coach.ask(input());
    expect(result.response).toBe("Play Qh8.");
  });

  it("drops follow-ups from a reply that was cut off by the token limit", async () => {
    const { coach } = makeCoach(reply("Develop and castle.\nFOLLOWUPS: Why castle early | What about the", "max_tokens"));
    const result = await coach.ask(input());
    expect(result).toEqual({ response: "Develop and castle.", followUps: [] });
  });

  it("raises EmptyResponseError when the model returns no usable text", async () => {
    await expect(makeCoach({ content: [], stop_reason: "refusal" }).coach.ask(input())).rejects.toBeInstanceOf(EmptyResponseError);
    await expect(makeCoach(reply("FOLLOWUPS: A idea | B idea")).coach.ask(input())).rejects.toBeInstanceOf(EmptyResponseError);
  });

  it("propagates upstream errors for the HTTP layer to translate", async () => {
    const upstream = Object.assign(new Error("overloaded"), { status: 529 });
    await expect(makeCoach(upstream).coach.ask(input())).rejects.toBe(upstream);
  });

  it("recognises only configured grandmasters, including not inherited object keys", () => {
    const { coach } = makeCoach();
    expect(coach.isKnownGM("Hikaru")).toBe(true);
    expect(coach.isKnownGM("constructor")).toBe(false);
    expect(coach.isKnownGM("Kasparov")).toBe(false);
  });
});
