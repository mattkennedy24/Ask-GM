import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { BOARD } from "../lib/boardTheme";
import { DESKTOP_QUERY } from "../lib/layout";

/**
 * The design system, enforced.
 *
 * A style guide nobody checks drifts in a month. These tests read the source and fail when a component steps
 * outside the system: an arbitrary font size, a colour that is not a token, a shadow, an emoji, or a pair of
 * colours that is hard to read. See docs/design-system.md for the reasoning behind each rule.
 */

const read = (path: URL) => fs.readFileSync(path, "utf8");
const here = (relative: string) => new URL(relative, import.meta.url);

function filesUnder(dir: URL, extensions: string[]): { name: string; text: string }[] {
  const out: { name: string; text: string }[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
    if (entry.isDirectory()) out.push(...filesUnder(child, extensions));
    else if (extensions.some((ext) => entry.name.endsWith(ext)) && !/\.test\./.test(entry.name)) out.push({ name: child.pathname.split("/src/")[1] ?? entry.name, text: read(child) });
  }
  return out;
}

const SRC = here("../");
const tokens = read(here("./tokens.css"));
const cssFiles = ["tokens.css", "base.css", "primitives.css", "features.css", "motion.css"].map((name) => ({ name, text: read(here(`./${name}`)) }));
const components = [...filesUnder(here("../components/"), [".tsx"]), { name: "App.tsx", text: read(here("../App.tsx")) }];

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("typography", () => {
  it("has exactly the seven sizes of the scale", () => {
    const sizes = [...new Set([...tokens.matchAll(/--fs-([a-z]+):/g)].map((match) => match[1]))];
    expect(sizes.sort()).toEqual(["body", "coord", "display", "label", "lead", "small", "title"]);
  });

  it("sets every font size, in every stylesheet, from the scale (or relative to the text around it)", () => {
    const offenders: string[] = [];
    for (const { name, text } of cssFiles) {
      if (name === "tokens.css") continue;
      for (const match of stripComments(text).matchAll(/font-size:\s*([^;]+);/g)) {
        const value = match[1].trim();
        if (!/^var\(--fs-[a-z]+\)$/.test(value) && !/^[\d.]+em$/.test(value)) offenders.push(`${name}: font-size: ${value}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("sets every font shorthand from a type role", () => {
    const offenders: string[] = [];
    for (const { name, text } of cssFiles) {
      for (const match of stripComments(text).matchAll(/(?<![-\w])font:\s*([^;]+);/g)) {
        const value = match[1].trim();
        if (name === "tokens.css") continue; // the roles themselves are defined with custom properties, not `font:`
        if (!/^var\(--type-[a-z]+\)$/.test(value) && value !== "inherit") offenders.push(`${name}: font: ${value}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("uses only the four weights", () => {
    const offenders: string[] = [];
    for (const { name, text } of cssFiles) {
      for (const match of stripComments(text).matchAll(/font-weight:\s*([^;]+);/g)) {
        if (!/^(400|500|600|700|inherit)$/.test(match[1].trim())) offenders.push(`${name}: font-weight: ${match[1].trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps type out of the components: no inline typography and no off-scale utilities", () => {
    const offenders: string[] = [];
    const offScale = /(?<![\w-])(?:text-(?:xs|sm|base|lg|xl|[2-9]xl|\[)|font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\[)|leading-|tracking-)/;
    for (const { name, text } of components) {
      for (const match of text.matchAll(/class(?:Name)?=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
        const classes = match[1] ?? match[2] ?? "";
        if (offScale.test(classes)) offenders.push(`${name}: ${classes}`);
      }
      if (/(?:fontSize|fontFamily|fontWeight|letterSpacing|lineHeight|textTransform)\s*:/.test(text)) offenders.push(`${name}: inline typography`);
    }
    expect(offenders).toEqual([]);
  });
});

describe("colour", () => {
  it("has no colour literals in components (everything comes from a token)", () => {
    const offenders: string[] = [];
    for (const { name, text } of components) {
      if (/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(/.test(text.replace(/&#\d+;/g, ""))) offenders.push(name);
    }
    expect(offenders).toEqual([]);
  });

  it("uses no stock palette utilities (red-500, gray-400, white, black …)", () => {
    const offenders: string[] = [];
    const palette = /(?<![\w-])(?:bg|text|border|ring|fill|stroke|from|to|via|divide|outline|accent|caret|decoration)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d+)?(?![\w-])/;
    for (const { name, text } of components) {
      for (const match of text.matchAll(/class(?:Name)?=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
        if (palette.test(match[1] ?? match[2] ?? "")) offenders.push(`${name}: ${match[1] ?? match[2]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("only lets components set inline styles for a custom property or an animation delay", () => {
    const offenders: string[] = [];
    for (const { name, text } of components) {
      for (const match of text.matchAll(/style=\{\{([^}]*)\}\}/g)) {
        const keys = match[1].split(",").map((part) => part.trim().split(":")[0].trim()).filter(Boolean);
        for (const key of keys) {
          if (!key.startsWith('["--') && key !== "animationDelay") offenders.push(`${name}: style ${key}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the board's colours in step with the tokens", () => {
    const token = (name: string) => tokens.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim();
    expect(BOARD.light).toBe(token("board-light"));
    expect(BOARD.dark).toBe(token("board-dark"));
    expect(BOARD.lastMove).toBe(token("board-last-move"));
    expect(BOARD.selected).toBe(token("board-selected"));
    expect(BOARD.check).toBe(token("board-check"));
    expect(BOARD.engineArrow).toBe(token("color-engine"));
    expect(BOARD.userArrow).toBe(token("color-ink"));
  });
});

describe("flat, calm surfaces", () => {
  it("has no shadows, blurs or gradients in the stylesheets", () => {
    const offenders: string[] = [];
    for (const { name, text } of cssFiles) {
      for (const match of stripComments(text).matchAll(/(box-shadow|text-shadow|filter|backdrop-filter|linear-gradient|radial-gradient|conic-gradient)\s*[:(]/g)) {
        offenders.push(`${name}: ${match[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("has no shadow, blur or gradient utilities in the components", () => {
    const offenders: string[] = [];
    for (const { name, text } of components) {
      for (const match of text.matchAll(/class(?:Name)?=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
        if (/(?<![\w-])(?:shadow|drop-shadow|blur|backdrop-|bg-gradient|bg-linear|from-|to-|via-)/.test(match[1] ?? match[2] ?? "")) offenders.push(`${name}: ${match[1] ?? match[2]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("uses only the declared radii", () => {
    const offenders: string[] = [];
    for (const { name, text } of cssFiles) {
      for (const match of stripComments(text).matchAll(/border-radius:\s*([^;]+);/g)) {
        if (!/^(var\(--radius-(?:tile|small|pill)\)|50%|0)$/.test(match[1].trim())) offenders.push(`${name}: ${match[1].trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("has no emoji anywhere in the interface", () => {
    const emoji = /\p{Emoji_Presentation}|\p{Extended_Pictographic}️/u;
    const offenders = [...filesUnder(SRC, [".ts", ".tsx", ".css"])].filter(({ name, text }) => !name.includes("data/") && emoji.test(text)).map(({ name }) => name);
    expect(offenders).toEqual([]);
  });
});

/** WCAG contrast ratio between two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const channel = (offset: number) => {
      const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  };
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("contrast", () => {
  const color = (name: string) => {
    const match = tokens.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
    if (!match) throw new Error(`no colour token --color-${name}`);
    return match[1];
  };

  // [text, background, minimum ratio, where it is used]
  const pairs: [string, string, number, string][] = [
    ["ink", "paper", 7, "body text"],
    ["ink-2", "paper", 7, "secondary text"],
    ["ink-2", "paper-2", 7, "secondary text on tiles"],
    ["ink-3", "paper", 4.5, "captions"],
    ["ink-3", "paper-2", 4.5, "captions on tiles"],
    ["ink", "paper-3", 7, "inaccuracy badge"],
    ["ink", "surface", 7, "dialog text"],
    ["paper", "ink", 7, "primary buttons, toast"],
    ["marker", "ink", 7, "toast action"],
    ["ink", "marker", 7, "the current move"],
    ["ink", "engine-wash", 7, "a selected engine line"],
    ["surface", "engine", 4.5, "the engine's current step"],
    ["danger", "paper", 4.5, "errors, check"],
    ["danger", "surface", 4.5, "errors in dialogs"],
    ["surface", "danger", 4.5, "blunder badge"],
    ["magnus", "paper", 4.5, "Magnus's ink"],
    ["hikaru", "paper", 4.5, "Hikaru's ink"],
    ["bobby", "paper", 4.5, "Bobby's ink"],
    ["magnus", "surface", 4.5, "Magnus's ink on white"],
    ["hikaru", "surface", 4.5, "Hikaru's ink on white"],
    ["bobby", "surface", 4.5, "Bobby's ink on white"],
  ];

  it.each(pairs)("%s on %s reads at %d:1 or better (%s)", (text, background, minimum) => {
    expect(contrast(color(text), color(background))).toBeGreaterThanOrEqual(minimum);
  });
});

describe("one layout query", () => {
  it("is the same in the script, the Tailwind variant and every raw media query", () => {
    const normalise = (query: string) => query.replace(/\s+/g, " ").trim();
    const index = read(here("../index.css"));
    const variant = index.match(/@custom-variant desk \(@media ([^;]+)\);/)?.[1];
    expect(normalise(variant ?? "")).toBe(normalise(DESKTOP_QUERY));

    for (const { name, text } of cssFiles) {
      for (const match of stripComments(text).matchAll(/@media\s+([^{]*orientation:\s*landscape[^{]*)\{/g)) {
        expect(normalise(match[1]), `${name} must use the same laptop query`).toBe(normalise(DESKTOP_QUERY));
      }
    }
  });
});

describe("brand colours outside the stylesheets", () => {
  const token = (name: string) => tokens.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1].toLowerCase();
  const root = (relative: string) => read(new URL(`../../${relative}`, import.meta.url));

  it("paints the page, the browser bar and the installed app in the paper colour", () => {
    const html = root("index.html");
    expect(html.match(/name="theme-color" content="(#[0-9a-fA-F]{6})"/)?.[1].toLowerCase()).toBe(token("paper"));
    expect(html.match(/html\s*\{\s*background:\s*(#[0-9a-fA-F]{6})/)?.[1].toLowerCase()).toBe(token("paper"));
    const manifest = JSON.parse(root("public/site.webmanifest"));
    expect(manifest.background_color.toLowerCase()).toBe(token("paper"));
    expect(manifest.theme_color.toLowerCase()).toBe(token("paper"));
  });

  it("draws the icons in ink and paper", () => {
    const favicon = root("public/favicon.svg").toLowerCase();
    expect(favicon).toContain(token("ink"));
    expect(favicon).toContain(token("paper"));
    const maker = root("scripts/make-icons.mjs").toLowerCase();
    expect(maker).toContain(token("ink"));
    expect(maker).toContain(token("paper"));
  });
});
