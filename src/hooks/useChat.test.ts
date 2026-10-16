import { describe, expect, it } from "vitest";
import { buildHistory, type ChatMessage } from "./useChat";

const msg = (id: number, role: "user" | "gm", ply: number, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id: String(id),
  role,
  text: `${role} ${id}`,
  fen: "",
  ply,
  ...extra,
});

describe("buildHistory", () => {
  it("maps roles to what the API expects", () => {
    expect(buildHistory([msg(1, "user", 4), msg(2, "gm", 4)], 4)).toEqual([
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
    expect(buildHistory(messages, 2).map((m) => m.content)).toEqual(["user 2", "gm 5"]);
  });

  it("drops turns about positions far from the current one", () => {
    const messages = [msg(1, "user", 2), msg(2, "gm", 2), msg(3, "user", 30), msg(4, "gm", 30)];
    expect(buildHistory(messages, 31).map((m) => m.content)).toEqual(["user 3", "gm 4"]);
    expect(buildHistory(messages, 3).map((m) => m.content)).toEqual(["user 1", "gm 2"]);
  });

  it("keeps only the most recent turns", () => {
    const many = Array.from({ length: 20 }, (_, i) => msg(i, i % 2 ? "gm" : "user", 5));
    const history = buildHistory(many, 5);
    expect(history).toHaveLength(6);
    expect(history.at(-1)?.content).toBe("gm 19");
  });

  it("returns nothing for an empty thread", () => {
    expect(buildHistory([], 0)).toEqual([]);
  });
});
