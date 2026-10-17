/**
 * The model is asked to end every reply with a line of suggested next questions:
 *
 *     FOLLOWUPS: first question | second question | third question
 *
 * This splits that line off the reply. It tolerates the ways models actually
 * format it (trailing whitespace, markdown decoration, bullets on separate lines)
 * and, when the reply was cut off by the token limit, discards the half-written
 * suggestions instead of showing a broken chip.
 */

const MAX_FOLLOW_UPS = 3;
const MIN_LENGTH = 3;
const MAX_LENGTH = 80;

// "FOLLOWUPS:", "Follow-ups:", "**FOLLOWUPS:**", "- FOLLOWUPS:" at the start of a line.
const MARKER = /^[ \t>*_#-]*follow[ -]?ups?[ \t]*:[ \t]*\**/gim;

function cleanItem(item) {
  return item
    .replace(/^[\s>*_#•\d.)\-–—"'`]+/, "") // bullets, numbering, opening quotes
    .replace(/[\s*_"'`]+$/, "") // closing quotes / emphasis
    .trim();
}

/**
 * @param {string} raw model output
 * @param {{ truncated?: boolean }} [options] truncated = stop_reason was max_tokens
 * @returns {{ text: string, followUps: string[] }}
 */
export function parseFollowUps(raw, { truncated = false } = {}) {
  const source = String(raw ?? "").replace(/\r\n?/g, "\n");

  let last = null;
  for (const match of source.matchAll(MARKER)) last = match;
  if (!last) return { text: source.trim(), followUps: [] };

  const text = source.slice(0, last.index).trim();
  if (truncated) return { text, followUps: [] };

  const tail = source.slice(last.index + last[0].length);
  const seen = new Set();
  const followUps = [];
  for (const piece of tail.split(/\||\n/)) {
    const item = cleanItem(piece);
    const key = item.toLowerCase();
    if (item.length < MIN_LENGTH || item.length > MAX_LENGTH || seen.has(key)) continue;
    seen.add(key);
    followUps.push(item);
    if (followUps.length === MAX_FOLLOW_UPS) break;
  }
  return { text, followUps };
}
