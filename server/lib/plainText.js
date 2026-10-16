/**
 * The grandmasters should read like someone texting back, not like a document.
 * The prompt asks for plain prose; this removes any markdown that slips through so
 * the chat (and the history sent back to the model on later turns) stays clean.
 *
 * Move numbers such as "1. e4" are deliberately left alone — only bullets are removed.
 */
export function toPlainText(text) {
  return String(text ?? "")
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
