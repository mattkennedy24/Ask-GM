import { describe, expect, it, vi } from "vitest";
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
    expect(request.max_tokens).toBe(700);
    expect(request.system).toContain("You are Magnus Carlsen");
    expect(request.system).toContain(START_FEN);
    expect(request.messages).toEqual([...history, { role: "user", content: "Best move?" }]);
  });

  it("strips markdown from the model's reply", async () => {
    const { coach } = makeCoach(reply("## Plan\n**Play e4** now.\n- it is best\nFOLLOWUPS: A idea | B idea | C idea"));
    const { response } = await coach.ask(input());
    expect(response).toBe("Plan\nPlay e4 now.\nit is best");
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
