/**
 * The board's colours, for the parts of the board library that take style objects.
 * They mirror the --board-* and ink/marker tokens in src/styles/tokens.css; a test keeps the two in step.
 */
export const BOARD = {
  light: "#f0e9d4",
  dark: "#b5a98c",
  lastMove: "rgba(255, 217, 15, 0.55)",
  selected: "rgba(255, 217, 15, 0.85)",
  check: "rgba(184, 55, 42, 0.62)",
  /** A small ink dot on an empty target square, and a ring around a piece that can be taken. */
  legalDot: "radial-gradient(circle, rgba(26, 25, 21, 0.28) 22%, transparent 24%)",
  legalCapture: "radial-gradient(circle, transparent 58%, rgba(26, 25, 21, 0.28) 60%)",
  /** Coordinates in the corners of the squares: readable on both colours, set small in the sans. */
  notation: { color: "var(--color-ink-2)", fontFamily: "var(--font-sans)", fontSize: "var(--fs-coord)", fontWeight: 600 },
  /** The engine's suggestion is blue; arrows you draw yourself are ink. (The board adds its own transparency.) */
  engineArrow: "#2f78c4",
  userArrow: "#1a1915",
} as const;
