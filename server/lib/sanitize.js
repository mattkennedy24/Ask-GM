import { Chess } from "chess.js";

/**
 * Input sanitisation for /api/chat.
 *
 * Every field that reaches the model (and several end up inside the *system*
 * prompt) is validated against a strict shape here, so a hand-crafted request
 * cannot smuggle instructions in through the FEN, opening name, engine lines or
 * move list.
 */

export const LIMITS = Object.freeze({
  question: 1000,
  historyMessages: 10,
  historyContent: 2000,
  moveHistory: 300,
  topLines: 5,
  pvMoves: 12,
  openingName: 80,
  fen: 100,
});

// C0/C1 control characters (keeping tab, newline and carriage return), DEL, soft hyphen, and the
// invisible zero-width / bidi / line-separator characters used to hide injected text.
// Built from numeric ranges so this source file stays plain ASCII.
const INVISIBLE_RANGES = [
  [0x00, 0x08],
  [0x0b, 0x0c],
  [0x0e, 0x1f],
  [0x7f, 0x9f],
  [0xad, 0xad],
  [0x200b, 0x200f],
  [0x2028, 0x202e],
  [0x2060, 0x206f],
  [0xfeff, 0xfeff],
];
const INVISIBLE = new RegExp(
  `[${INVISIBLE_RANGES.map(([from, to]) => `${String.fromCodePoint(from)}-${String.fromCodePoint(to)}`).join("")}]`,
  "g",
);

const SAN_RE = /^(?:O-O(?:-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?)[+#]?$/;
const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/** Cut by code point so a surrogate pair (emoji) is never split in half. */
function truncate(text, max) {
  const chars = Array.from(text);
  return chars.length <= max ? text : chars.slice(0, max).join("");
}

/** Multi-line free text (the question, prior chat turns). */
export function sanitizeText(value, maxLen) {
  if (typeof value !== "string") return "";
  const cleaned = value
    .replace(INVISIBLE, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return truncate(cleaned, maxLen);
}

/** Canonical FEN string, or null when the input is not a legal FEN position. */
export function sanitizeFen(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > LIMITS.fen) return null;
  try {
    return new Chess(trimmed).fen();
  } catch {
    return null;
  }
}

/** Opening names are shown to the model; keep letters, digits and light punctuation only. */
export function sanitizeOpeningName(value) {
  if (typeof value !== "string") return "";
  const cleaned = value
    .replace(INVISIBLE, "")
    .replace(/\s+/g, " ") // newlines/tabs become spaces first so neighbouring words don't fuse
    .replace(/[^\p{L}\p{N} '’:()—–\-.,/&]/gu, "")
    .replace(/ {2,}/g, " ")
    .trim();
  return truncate(cleaned, LIMITS.openingName);
}

/** SAN move list that has already been played; anything that is not a SAN token is dropped. */
export function sanitizeMoveHistory(value) {
  if (!Array.isArray(value)) return [];
  const moves = [];
  for (const move of value.slice(0, LIMITS.moveHistory)) {
    if (typeof move === "string" && move.length <= 10 && SAN_RE.test(move)) moves.push(move);
  }
  return moves;
}

function finiteOrNull(value, min, max) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : null;
}

function intOrNull(value, min, max) {
  const n = finiteOrNull(value, min, max);
  return n === null ? null : Math.round(n);
}

/**
 * Engine lines as reported by the browser: validated as UCI moves and bounded
 * numbers. A principal variation is cut at its first malformed move so the
 * remainder can never be replayed out of order.
 */
export function sanitizeTopLines(value) {
  if (!Array.isArray(value)) return [];
  const lines = [];
  for (const raw of value.slice(0, LIMITS.topLines)) {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.pv)) continue;
    const pv = [];
    for (const move of raw.pv.slice(0, LIMITS.pvMoves)) {
      if (typeof move !== "string" || !UCI_RE.test(move)) break;
      pv.push(move);
    }
    if (pv.length === 0) continue;
    lines.push({
      pv,
      score: finiteOrNull(raw.score, -100000, 100000),
      mate: intOrNull(raw.mate, -200, 200),
      depth: intOrNull(raw.depth, 0, 99),
    });
  }
  return lines;
}

function normalizeRole(role) {
  if (role === "user" || role === "You") return "user";
  if (role === "assistant" || role === "GM") return "assistant";
  return null;
}

/**
 * Prior chat turns, reshaped so the Anthropic API accepts them: roles are
 * whitelisted, consecutive same-role turns are merged, and the list starts with a
 * user turn and ends with an assistant turn (the new question is appended after).
 * The API rejects conversations that begin with an assistant message, which a
 * plain `slice(-n)` of the history can easily produce.
 */
export function sanitizeHistory(value) {
  if (!Array.isArray(value)) return [];

  const cleaned = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const role = normalizeRole(item.role);
    const content = sanitizeText(item.content, LIMITS.historyContent);
    if (role && content) cleaned.push({ role, content });
  }

  const merged = [];
  for (const message of cleaned.slice(-LIMITS.historyMessages)) {
    const previous = merged[merged.length - 1];
    if (previous && previous.role === message.role) previous.content += `\n\n${message.content}`;
    else merged.push({ ...message });
  }

  while (merged.length > 0 && merged[0].role !== "user") merged.shift();
  while (merged.length > 0 && merged[merged.length - 1].role !== "assistant") merged.pop();
  return merged;
}

/**
 * Validate and normalise a /api/chat request body.
 * @param {unknown} body
 * @param {(name: string) => boolean} isKnownGM
 * @returns {{ ok: true, value: object } | { ok: false, error: string }}
 */
export function validateChatPayload(body, isKnownGM) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  if (typeof body.selectedGM !== "string" || !isKnownGM(body.selectedGM)) {
    return { ok: false, error: "Unknown grandmaster." };
  }
  const fen = sanitizeFen(body.currentFen);
  if (!fen) return { ok: false, error: "currentFen is not a valid FEN position." };

  const question = sanitizeText(body.question, LIMITS.question);
  if (!question) return { ok: false, error: "Please enter a question." };

  return {
    ok: true,
    value: {
      selectedGM: body.selectedGM,
      fen,
      question,
      history: sanitizeHistory(body.conversationHistory),
      moveHistory: sanitizeMoveHistory(body.moveHistory),
      topLines: sanitizeTopLines(body.topLines),
      openingName: sanitizeOpeningName(body.openingName),
    },
  };
}
