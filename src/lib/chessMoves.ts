import { Chess, type Move } from "chess.js";

const MOVE_PARTS = /^([KQRBN])?([a-h])?([1-8])?(x)?([a-h][1-8])(?:=([QRBN]))?$/;

/**
 * Canonical key for a SAN move. Check symbols, capture markers and disambiguation
 * are ignored for piece moves, so "Nd2", "Nbd2" and "Nxd2" compare equal.
 * (Mirrors server/lib/moveValidation.js — both sides must agree on what counts as the same move.)
 */
export function moveKey(san: string): string {
  const s = san.replace(/[+#!?]+$/, "");
  if (s === "O-O" || s === "O-O-O") return s;

  const parts = MOVE_PARTS.exec(s);
  if (!parts) return s;
  const [, piece, fromFile, , capture, destination, promotion] = parts;

  if (piece) return `${piece}${destination}`;
  const suffix = promotion ? `=${promotion}` : "";
  return capture ? `${fromFile}x${destination}${suffix}` : `${destination}${suffix}`;
}

export interface ResolvedMove {
  from: string;
  to: string;
  promotion?: string;
  /** The move in the position's own, correctly-disambiguated SAN. */
  san: string;
}

type LegalMove = Pick<Move, "from" | "to" | "san" | "promotion">;

const stripCheck = (san: string) => san.replace(/[+#!?]+$/, "");

/**
 * Resolve a move as written in prose ("Nf3", "Bxe5+", "Nbd2") against a list of
 * legal moves. Returns the one move it means, or null when it is illegal or still
 * ambiguous (e.g. "Nd2" when two knights can go there).
 */
export function resolveAgainst(legal: readonly LegalMove[], token: string): ResolvedMove | null {
  const toResult = (m: LegalMove): ResolvedMove => ({ from: m.from, to: m.to, promotion: m.promotion, san: m.san });

  // Exact SAN first, so a deliberately disambiguated "Nbd2" picks the right knight.
  const exact = legal.filter((m) => stripCheck(m.san) === stripCheck(token));
  if (exact.length === 1) return toResult(exact[0]);

  const key = moveKey(token);
  const loose = legal.filter((m) => moveKey(m.san) === key);
  return loose.length === 1 ? toResult(loose[0]) : null;
}

/** Resolve a move written in prose against the position `fen`. */
export function resolveMove(fen: string, token: string): ResolvedMove | null {
  try {
    return resolveAgainst(new Chess(fen).moves({ verbose: true }), token);
  } catch {
    return null;
  }
}
