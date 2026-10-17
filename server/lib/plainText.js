// Emoji: characters that render as a picture by default, symbols the author explicitly asked to
// show as a picture (a variation selector follows), skin-tone and ZWJ sequences, and flag pairs.
// Text-style symbols such as the copyright and trademark signs, arrows and the chess figurines are
// notation or punctuation rather than decoration, so they stay.
const EMOJI = new RegExp(
  [
    "\\p{Emoji_Presentation}(?:\\uFE0F|[\\u{1F3FB}-\\u{1F3FF}]|\\u200D(?:\\p{Emoji_Presentation}|\\p{Extended_Pictographic}\\uFE0F?))*",
    "\\p{Extended_Pictographic}\\uFE0F(?:\\u200D(?:\\p{Emoji_Presentation}|\\p{Extended_Pictographic}\\uFE0F?))*",
    "[\\u{1F1E6}-\\u{1F1FF}]{2}",
  ].join("|"),
  "gu",
);

/** Removes emoji and tidies the spacing they leave behind ("Nice move !" becomes "Nice move!"). */
export function stripEmoji(text) {
  const source = String(text ?? "");
  const stripped = source.replace(EMOJI, "");
  if (stripped === source) return source;
  return stripped.replace(/[ \t]{2,}/g, " ").replace(/ +([.,!?;:])/g, "$1");
}

/**
 * The grandmasters should read like someone texting back, not like a document.
 * The prompt asks for plain prose; this removes any markdown that slips through so
 * the chat (and the history sent back to the model on later turns) stays clean.
 *
 * Move numbers such as "1. e4" are deliberately left alone — only bullets are removed.
 * Emoji are removed as well: the app's tone is a grandmaster's text message, not a chat sticker.
 */
export function toPlainText(text) {
  return stripEmoji(text)
    .replace(/```[a-z]*\n?([\s\S]*?)```/gi, "$1") // code fences → content
    .replace(/^#{1,6}[ \t]+/gm, "") // headings
    .replace(/^>[ \t]?/gm, "") // block quotes
    .replace(/^[ \t]*[-*•][ \t]+/gm, "") // bullets
    .replace(/^[ \t]*([-*_])([ \t]*\1){2,}[ \t]*$/gm, "") // horizontal rules
    .replace(/\[([^\]\n]+)\]\((?:https?:\/\/|mailto:)[^)\s]+\)/g, "$1") // [text](url) → text
    .replace(/\*\*([^*\n]+)\*\*/g, "$1") // **bold**
    .replace(/__([^_\n]+)__/g, "$1") // __bold__
    .replace(/(?<![\w*])\*([^*\n]+)\*(?![\w*])/g, "$1") // *italic*
    .replace(/(?<![\w_])_([^_\n]+)_(?![\w_])/g, "$1") // _italic_
    .replace(/`([^`\n]+)`/g, "$1") // `code`
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
