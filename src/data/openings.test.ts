import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { CATEGORIES, OPENINGS } from "./openings";
import { detectOpening } from "../lib/openingDetection";

interface NamedLine {
  label: string;
  eco: string;
  moves: string[];
  annotations?: string[];
}

const lines: NamedLine[] = OPENINGS.flatMap((opening) => [
  { label: opening.name, eco: opening.eco, moves: opening.moves, annotations: opening.annotations },
  ...(opening.variations ?? []).map((v) => ({
    label: `${opening.name} / ${v.name}`,
    eco: v.eco ?? opening.eco,
    moves: v.moves,
    annotations: v.annotations,
  })),
]);

const uci = (...sans: string[]) => {
  const chess = new Chess();
  return sans.map((san) => {
    const m = chess.move(san);
    return `${m.from}${m.to}${m.promotion ?? ""}`;
  });
};

describe("opening lesson data", () => {
  it("has openings in every category", () => {
    for (const category of CATEGORIES) {
      expect(OPENINGS.some((o) => o.category === category), category).toBe(true);
    }
  });

  it("uses unique names and ECO-formatted codes", () => {
    const keys = OPENINGS.map((o) => `${o.eco}-${o.name}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const line of lines) expect(line.eco, line.label).toMatch(/^[A-E]\d\d$/);
  });

  it.each(lines.map((l) => [l.label, l] as const))("%s: every move is legal from the starting position", (_label, line) => {
    const chess = new Chess();
    line.moves.forEach((move, i) => {
      let ok = true;
      try {
        chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
      } catch {
        ok = false;
      }
      expect(ok, `ply ${i + 1} (${move}) after ${chess.history().join(" ")}`).toBe(true);
    });
    expect(line.moves.length).toBeGreaterThanOrEqual(8);
  });

  it.each(lines.map((l) => [l.label, l] as const))("%s: annotations never outnumber the moves", (_label, line) => {
    expect(line.annotations?.length ?? 0).toBeLessThanOrEqual(line.moves.length);
  });

  it("describes the move it sits on: the side named in an annotation matches the ply", () => {
    const problems: string[] = [];
    for (const line of lines) {
      line.annotations?.forEach((text, i) => {
        const whiteMoved = i % 2 === 0;
        if (whiteMoved && /^Black\b/.test(text)) problems.push(`${line.label} ply ${i + 1}: ${text.slice(0, 40)}`);
        if (!whiteMoved && /^White\b/.test(text)) problems.push(`${line.label} ply ${i + 1}: ${text.slice(0, 40)}`);
      });
    }
    expect(problems).toEqual([]);
  });
});

describe("detectOpening", () => {
  it("claims nothing until a game commits to one opening", () => {
    expect(detectOpening([])).toBeNull();
    expect(detectOpening(uci("e4"))).toBeNull();
    expect(detectOpening(uci("e4", "e5"))).toBeNull();
    // Ruy Lopez, Italian, Petroff, Evans... all share 1.e4 e5 2.Nf3. The old code said "Ruy Lopez" here.
    expect(detectOpening(uci("e4", "e5", "Nf3"))).toBeNull();
    expect(detectOpening(uci("e4", "e5", "Nf3", "Nc6"))).toBeNull();
  });

  it("names an opening once only one follows the game", () => {
    expect(detectOpening(uci("e4", "e5", "Nf3", "Nc6", "Bb5"))).toMatchObject({ name: "Ruy Lopez (Spanish)", eco: "C60" });
    expect(detectOpening(uci("d4", "d5", "c4", "e6"))).toMatchObject({ name: "Queen's Gambit Declined", eco: "D30" });
    expect(detectOpening(uci("d4", "d5", "c4", "dxc4"))).toMatchObject({ name: "Queen's Gambit Accepted" });
    expect(detectOpening(uci("c4", "e5"))).toMatchObject({ name: "English Opening" });
  });

  it("names the sub-variation when only it follows the game", () => {
    const berlin = detectOpening(uci("e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6"));
    expect(berlin).toMatchObject({ name: "Ruy Lopez (Spanish) — Berlin Defense", eco: "C67" });
    const evans = detectOpening(uci("e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "b4"));
    expect(evans).toMatchObject({ name: "Evans Gambit" });
  });

  it("keeps the opening's name when the game wanders off its main line", () => {
    // 3...a6 4.Bxc6 (the Exchange Variation) is not a lesson line, but it is still a Ruy Lopez.
    const exchange = detectOpening(uci("e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Bxc6", "dxc6"));
    expect(exchange).toMatchObject({ name: "Ruy Lopez (Spanish)" });
  });

  it("stays quiet for lines outside the lesson set", () => {
    expect(detectOpening(uci("a3", "a6"))).toBeNull();
    expect(detectOpening(uci("g4", "d5"))).toBeNull();
  });
});
