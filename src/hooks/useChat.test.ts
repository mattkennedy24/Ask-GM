import { describe, expect, it } from "vitest";
import { buildHistory, type ChatMessage, removeFailedExchange } from "./useChat";

const msg = (id: number, role: "user" | "gm", ply: number, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id: String(id),
  role,
  text: `${role} ${id}`,
  fen: "",
  ply,
  scope: "game-1",
  ...extra,
});

describe("buildHistory", () => {
  it("maps roles to what the API expects", () => {
    expect(buildHistory([msg(1, "user", 4), msg(2, "gm", 4)], 4, "game-1")).toEqual([
      { role: "user", content: "user 1" },
      { role: "assistant", content: "gm 2" },
    ]);
  });

  it("leaves out greetings, notes and errors", () => {
    const messages = [
      msg(1, "gm", 0, { kind: "welcome" }),
      msg(2, "user", 2),
      msg(3, "gm", 2, { kind: "error", retry: "q" }),
      msg(4, "gm", 2, { kind: "note" }),
      msg(5, "gm", 2),
    ];
    expect(buildHistory(messages, 2, "game-1").map((m) => m.content)).toEqual(["user 2", "gm 5"]);
  });

  it("drops turns about positions far from the current one", () => {
    const messages = [msg(1, "user", 2), msg(2, "gm", 2), msg(3, "user", 30), msg(4, "gm", 30)];
    expect(buildHistory(messages, 31, "game-1").map((m) => m.content)).toEqual(["user 3", "gm 4"]);
    expect(buildHistory(messages, 3, "game-1").map((m) => m.content)).toEqual(["user 1", "gm 2"]);
  });

  it("keeps only the most recent turns", () => {
    const many = Array.from({ length: 20 }, (_, i) => msg(i, i % 2 ? "gm" : "user", 5));
    const history = buildHistory(many, 5, "game-1");
    expect(history).toHaveLength(6);
    expect(history.at(-1)?.content).toBe("gm 19");
  });

  it("returns nothing for an empty thread", () => {
    expect(buildHistory([], 0, "game-1")).toEqual([]);
  });

  it("never mixes in answers about another game or lesson, even at the same ply", () => {
    const messages = [msg(1, "user", 4, { scope: "game-1" }), msg(2, "gm", 4, { scope: "game-1" }), msg(3, "user", 4, { scope: "game-2" }), msg(4, "gm", 4, { scope: "lesson-C60" })];
    expect(buildHistory(messages, 4, "game-2").map((m) => m.content)).toEqual(["user 3"]);
    expect(buildHistory(messages, 4, "lesson-C60").map((m) => m.content)).toEqual(["gm 4"]);
    expect(buildHistory(messages, 4, "game-1").map((m) => m.content)).toEqual(["user 1", "gm 2"]);
  });
});

describe("removeFailedExchange", () => {
  it("takes the failed question and its error out, so asking again does not duplicate the question", () => {
    const thread = [msg(1, "gm", 0, { kind: "welcome" }), msg(2, "user", 3, { text: "hello?" }), msg(3, "gm", 3, { kind: "error", text: "Can't reach the server.", retry: "hello?" })];
    expect(removeFailedExchange(thread, "3").map((m) => m.id)).toEqual(["1"]);
  });

  it("leaves other messages alone, including an identical question asked earlier", () => {
    const thread = [
      msg(1, "user", 2, { text: "best move?" }),
      msg(2, "gm", 2),
      msg(3, "user", 4, { text: "best move?" }),
      msg(4, "gm", 4, { kind: "error", retry: "best move?" }),
      msg(5, "gm", 4, { kind: "note" }),
    ];
    expect(removeFailedExchange(thread, "4").map((m) => m.id)).toEqual(["1", "2", "5"]);
  });

  it("only drops the error when the message before it is not the retried question", () => {
    const thread = [msg(1, "gm", 2), msg(2, "gm", 2, { kind: "error", retry: "why?" })];
    expect(removeFailedExchange(thread, "2").map((m) => m.id)).toEqual(["1"]);
  });

  it("does nothing for an unknown id", () => {
    const thread = [msg(1, "user", 1), msg(2, "gm", 1)];
    expect(removeFailedExchange(thread, "nope")).toEqual(thread);
  });
});
