import { useState, useEffect, useRef } from "react";
import type { DetectedOpening } from "../utils/openingDetection";

type Message = { sender: string; text: string; fen?: string; followUps?: string[] };

type ChatWindowProps = {
  messages: Message[];
  onSubmit: (question: string) => void;
  thinking?: boolean;
  selectedGM?: string;
  detectedOpening?: DetectedOpening | null;
  onMoveClick?: (san: string) => void;
};

const GM_COLORS: Record<string, string> = {
  Magnus: "var(--c-gm-magnus)",
  Hikaru: "var(--c-gm-hikaru)",
  Bobby:  "var(--c-gm-bobby)",
};

const GM_FULL_NAMES: Record<string, string> = {
  Magnus: "Magnus Carlsen",
  Hikaru: "Hikaru Nakamura",
  Bobby:  "Bobby Fischer",
};

const GM_LABELS: Record<string, string> = {
  Magnus: "MC",
  Hikaru: "HN",
  Bobby:  "BF",
};

const GM_SUBTITLES: Record<string, string> = {
  Magnus: "World Champion · Highest Elo in History",
  Hikaru: "Super-GM · Speed Chess Legend",
  Bobby:  "11th World Champion · The Purist",
};

const QUICK_ASKS = [
  "Best move?",
  "Explain the plan",
  "What did I do wrong?",
  "Why this engine move?",
];

// Chess notation regex — piece moves, castling, captures, pawn moves
const CHESS_MOVE_RE = /\b(O-O-O|O-O|[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[KQRBN])?[+#]?|[a-h]x[a-h][1-8](?:=[KQRBN])?[+#]?)\b/g;

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")               // ## Heading → plain text
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")        // **bold** → bold
    .replace(/__([^_\n]+)__/g, "$1")            // __bold__ → bold
    .replace(/\*([^*\n]+)\*/g, "$1")            // *italic* → italic
    .replace(/_([^_\n]+)_/g, "$1")              // _italic_ → italic
    .replace(/^[-*•]\s+/gm, "")                // - bullet → plain
    .replace(/^[-*_]{3,}\s*$/gm, "")           // --- horizontal rule → removed
    .replace(/`([^`]+)`/g, "$1")               // `code` → code (keep content, strip backticks)
    .replace(/\n{3,}/g, "\n\n")                // collapse excessive blank lines
    .trim();
}

function renderChessText(
  text: string,
  moveColor: string,
  onMoveClick?: (san: string) => void
) {
  const lines = stripMarkdown(text).split("\n");
  return lines.map((line, lineIdx) => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    CHESS_MOVE_RE.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = CHESS_MOVE_RE.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }
      const san = match[0];
      parts.push(
        <span
          key={`m-${lineIdx}-${match.index}`}
          className="move-token"
          role={onMoveClick ? "button" : undefined}
          tabIndex={onMoveClick ? 0 : undefined}
          onClick={onMoveClick ? () => onMoveClick(san) : undefined}
          onKeyDown={onMoveClick ? (e) => { if (e.key === "Enter" || e.key === " ") onMoveClick(san); } : undefined}
          title={onMoveClick ? `Play ${san}` : undefined}
          style={{
            color: moveColor,
            background: `${moveColor}18`,
            border: onMoveClick ? `1px solid ${moveColor}30` : "none",
          }}
        >
          {san}
        </span>
      );
      lastIndex = CHESS_MOVE_RE.lastIndex;
    }

    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }

    return (
      <span key={`line-${lineIdx}`}>
        {parts}
        {lineIdx < lines.length - 1 && <br />}
      </span>
    );
  });
}

const ChatWindow = ({
  messages,
  onSubmit,
  thinking,
  selectedGM = "Magnus",
  detectedOpening,
  onMoveClick,
}: ChatWindowProps) => {
  const [input, setInput] = useState("");
  const [sendConfirm, setSendConfirm] = useState(false);
  const [avatarPulse, setAvatarPulse] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const prevMessageCountRef = useRef(messages.length);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // Trigger avatar pulse when a new GM message arrives
  useEffect(() => {
    const prev = prevMessageCountRef.current;
    const curr = messages.length;
    if (curr > prev) {
      const lastMsg = messages[curr - 1];
      if (lastMsg.sender !== "You") {
        setAvatarPulse(true);
        setTimeout(() => setAvatarPulse(false), 400);
      }
    }
    prevMessageCountRef.current = curr;
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setSendConfirm(true);
    setTimeout(() => setSendConfirm(false), 400);
    onSubmit(trimmed);
    setInput("");
    inputRef.current?.focus();
  };

  const gmColor = GM_COLORS[selectedGM] ?? "var(--c-gold)";
  const gmLabel = GM_LABELS[selectedGM] ?? selectedGM.slice(0, 2).toUpperCase();
  const gmFullName = GM_FULL_NAMES[selectedGM] ?? selectedGM;
  const gmSubtitle = GM_SUBTITLES[selectedGM] ?? "";

  const hasOnlyWelcome = messages.length === 1;

  // Find follow-ups from the last GM message
  const lastGmMessage = [...messages].reverse().find((m) => m.sender !== "You");
  const followUps = lastGmMessage?.followUps ?? [];
  const showFollowUps = !thinking && followUps.length > 0 && !hasOnlyWelcome;

  return (
    <div className="panel flex flex-col h-full min-h-0 overflow-hidden">

      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--c-border)" }}
      >
        {/* GM avatar */}
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${avatarPulse ? "avatar-pulse" : ""}`}
          style={{
            background: `${gmColor}20`,
            border: `1.5px solid ${gmColor}55`,
            color: gmColor,
            fontFamily: "var(--f-mono)",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.04em",
            transition: "background 200ms ease, border-color 200ms ease",
          }}
        >
          {gmLabel}
        </span>
        <div className="flex flex-col min-w-0">
          <span
            className="text-sm font-semibold leading-tight"
            style={{ color: "var(--c-text)", fontFamily: "var(--f-sans)" }}
          >
            {gmFullName}
          </span>
          <span
            className="text-xs leading-tight mt-0.5 hidden sm:block"
            style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-sans)" }}
          >
            {gmSubtitle}
          </span>
        </div>
        <span
          className="text-xs ml-auto shrink-0"
          style={{ color: "var(--c-text-muted)" }}
        >
          ask anything
        </span>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 py-3 space-y-2.5">

        {/* Welcome state — show when only the intro message exists */}
        {hasOnlyWelcome && (
          <div className="flex justify-start">
            <span
              className="w-0.5 rounded-full shrink-0 mr-2.5 mt-1 self-stretch"
              style={{ background: gmColor, minHeight: "1rem" }}
            />
            <div
              className="max-w-[88%] text-sm leading-relaxed rounded-xl px-3.5 py-2.5 msg-in"
              style={{
                background: "var(--c-hover)",
                border: "1px solid var(--c-border-mid)",
                color: "var(--c-text)",
                borderBottomLeftRadius: "4px",
              }}
            >
              {messages[0].text}
            </div>
          </div>
        )}

        {!hasOnlyWelcome && messages.map((msg, i) => {
          const isUser = msg.sender === "You";
          const isLastGm = !isUser && i === messages.length - 1;
          return (
            <div
              key={i}
              className={`flex ${isUser ? "justify-end" : "justify-start"} msg-in`}
            >
              {!isUser && (
                <span
                  className="w-0.5 rounded-full shrink-0 mr-2.5 mt-1 self-stretch"
                  style={{ background: gmColor, minHeight: "1rem" }}
                />
              )}
              <div className="flex flex-col max-w-[88%] gap-1.5">
                <div
                  className="text-sm leading-relaxed rounded-xl px-3.5 py-2.5"
                  style={
                    isUser
                      ? {
                          background: "var(--c-raised)",
                          border: "1px solid var(--c-border-mid)",
                          color: "var(--c-text)",
                          borderBottomRightRadius: "4px",
                        }
                      : {
                          background: "var(--c-hover)",
                          border: "1px solid var(--c-border-mid)",
                          color: "var(--c-text)",
                          borderBottomLeftRadius: "4px",
                        }
                  }
                >
                  {isUser
                    ? msg.text
                    : renderChessText(msg.text, gmColor, onMoveClick)}
                </div>

                {/* Follow-up chips under the last GM message */}
                {isLastGm && showFollowUps && (
                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                    {followUps.map((q, qi) => (
                      <button
                        key={qi}
                        onClick={() => onSubmit(q)}
                        disabled={thinking}
                        className="chip-in text-xs px-2.5 py-1 rounded-full disabled:opacity-40"
                        style={{
                          background: "var(--c-raised)",
                          border: `1px solid ${gmColor}33`,
                          color: gmColor,
                          fontFamily: "var(--f-sans)",
                          whiteSpace: "nowrap",
                          transition: "background 150ms ease, border-color 150ms ease",
                          cursor: "pointer",
                          animationDelay: `${qi * 0.07}s`,
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = `${gmColor}18`;
                          (e.currentTarget as HTMLButtonElement).style.borderColor = gmColor;
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = "var(--c-raised)";
                          (e.currentTarget as HTMLButtonElement).style.borderColor = `${gmColor}33`;
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* ── Thinking indicator ── */}
        {thinking && (
          <div className="flex justify-start">
            <span
              className="w-0.5 rounded-full shrink-0 mr-2.5"
              style={{ background: gmColor, minHeight: "2rem", alignSelf: "stretch" }}
            />
            <div
              className="px-3.5 py-3 rounded-xl flex items-center gap-1.5"
              style={{
                background: "var(--c-hover)",
                border: "1px solid var(--c-border-mid)",
                borderBottomLeftRadius: "4px",
              }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="thinking-bar rounded-full"
                  style={{
                    width: "5px",
                    height: "14px",
                    background: gmColor,
                    animationDelay: `${i * 0.18}s`,
                    display: "inline-block",
                    opacity: 0.8,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Quick ask chips ── */}
      <div
        className="flex gap-1.5 px-3 pt-2 pb-1.5 overflow-x-auto shrink-0"
        style={{ borderTop: "1px solid var(--c-border)" }}
      >
        {/* Opening chip — shows if an opening is detected */}
        {detectedOpening && (
          <button
            onClick={() => onSubmit(`Explain the ${detectedOpening.name.split(" — ")[0]}`)}
            disabled={thinking}
            className="shrink-0 text-xs px-2.5 py-1 rounded-full disabled:opacity-40"
            style={{
              background: "var(--c-gold-dim)",
              border: "1px solid rgba(200,144,64,0.3)",
              color: "var(--c-gold)",
              fontFamily: "var(--f-sans)",
              whiteSpace: "nowrap",
              transition: "background 150ms ease, border-color 150ms ease",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(200,144,64,0.2)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--c-gold-dim)";
            }}
          >
            📖 {detectedOpening.name.split(" — ")[0]}
          </button>
        )}

        {QUICK_ASKS.map((q) => (
          <button
            key={q}
            onClick={() => onSubmit(q)}
            disabled={thinking}
            className="shrink-0 text-xs px-2.5 py-1 rounded-full disabled:opacity-40"
            style={{
              background: "var(--c-raised)",
              border: "1px solid var(--c-border-bright)",
              color: "var(--c-text-soft)",
              fontFamily: "var(--f-sans)",
              whiteSpace: "nowrap",
              transition: "background 150ms ease, border-color 150ms ease, color 150ms ease",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = gmColor;
              (e.currentTarget as HTMLButtonElement).style.color = gmColor;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--c-border-bright)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--c-text-soft)";
            }}
          >
            {q}
          </button>
        ))}
      </div>

      {/* ── Input ── */}
      <div className="flex gap-2 px-3 pb-3 pt-1.5 shrink-0">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder={`Ask ${gmFullName.split(" ")[0]}…`}
          disabled={thinking}
          className="flex-1 text-sm rounded-lg px-3.5 py-2.5 focus:outline-none"
          style={{
            background: "var(--c-raised)",
            border: "1px solid var(--c-border-bright)",
            color: "var(--c-text)",
            fontFamily: "var(--f-sans)",
            transition: "border-color 150ms ease, box-shadow 150ms ease",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = gmColor;
            e.currentTarget.style.boxShadow = `0 0 0 3px ${gmColor}18`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--c-border-bright)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || thinking}
          className={`shrink-0 px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed ${sendConfirm ? "send-confirm" : ""}`}
          style={{
            background: `${gmColor}22`,
            border: `1px solid ${gmColor}66`,
            color: sendConfirm ? "var(--c-text)" : gmColor,
            fontFamily: "var(--f-sans)",
            transition: "background 150ms ease, box-shadow 150ms ease, transform 80ms ease",
            minWidth: "56px",
          }}
          onMouseEnter={(e) => {
            if (!(e.currentTarget as HTMLButtonElement).disabled) {
              (e.currentTarget as HTMLButtonElement).style.background = `${gmColor}33`;
              (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 8px ${gmColor}30`;
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = `${gmColor}22`;
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
          }}
          onMouseDown={(e) => {
            if (!(e.currentTarget as HTMLButtonElement).disabled) {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.95)";
            }
          }}
          onMouseUp={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          }}
        >
          {sendConfirm ? "✓" : "Send"}
        </button>
      </div>
    </div>
  );
};

export default ChatWindow;
