import { useState, useEffect, useRef } from "react";

type Message = { sender: string; text: string };

type ChatWindowProps = {
  messages: Message[];
  onSubmit: (question: string) => void;
  thinking?: boolean;
  selectedGM?: string;
};

const GM_COLORS: Record<string, string> = {
  Magnus: "var(--c-gm-magnus)",
  Hikaru: "var(--c-gm-hikaru)",
  Bobby:  "var(--c-gm-bobby)",
};

const GM_LABELS: Record<string, string> = {
  Magnus: "MC",
  Hikaru: "HN",
  Bobby:  "BF",
};

const QUICK_ASKS = [
  "What's the best move?",
  "What's the plan here?",
  "What did I do wrong?",
];

const ChatWindow = ({ messages, onSubmit, thinking, selectedGM = "Magnus" }: ChatWindowProps) => {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setInput("");
    inputRef.current?.focus();
  };

  const gmColor = GM_COLORS[selectedGM] ?? "var(--c-gold)";
  const gmLabel = GM_LABELS[selectedGM] ?? selectedGM.slice(0, 2).toUpperCase();

  return (
    <div
      className="panel flex flex-col h-full min-h-0 overflow-hidden"
    >
      {/* ── Header ── */}
      <div
        className="flex items-center gap-2.5 px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--c-border)" }}
      >
        {/* GM avatar dot */}
        <span
          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0"
          style={{
            background: `${gmColor}22`,
            border: `1px solid ${gmColor}55`,
            color: gmColor,
            fontFamily: "var(--f-mono)",
            fontSize: "9px",
            letterSpacing: "0.05em",
          }}
        >
          {gmLabel}
        </span>
        <span
          className="text-sm font-semibold"
          style={{ color: "var(--c-text)", fontFamily: "var(--f-sans)" }}
        >
          {selectedGM}
        </span>
        <span
          className="text-xs ml-auto"
          style={{ color: "var(--c-text-muted)" }}
        >
          ask anything
        </span>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 py-3 space-y-3">
        {messages.map((msg, i) => {
          const isUser = msg.sender === "You";
          return (
            <div
              key={i}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <span
                  className="w-0.5 rounded-full shrink-0 mr-2.5 mt-1 self-stretch"
                  style={{ background: gmColor, minHeight: "1rem" }}
                />
              )}
              <div
                className="max-w-[88%] text-sm leading-relaxed rounded-xl px-3.5 py-2.5"
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
                {msg.text}
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
                    height: "5px",
                    background: gmColor,
                    animationDelay: `${i * 0.15}s`,
                    display: "inline-block",
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
        className="flex gap-1.5 px-3 pt-2 pb-1 overflow-x-auto shrink-0"
        style={{ borderTop: "1px solid var(--c-border)" }}
      >
        {QUICK_ASKS.map((q) => (
          <button
            key={q}
            onClick={() => onSubmit(q)}
            disabled={thinking}
            className="shrink-0 text-xs px-2.5 py-1 rounded-full transition-all duration-150 disabled:opacity-40"
            style={{
              background: "var(--c-raised)",
              border: "1px solid var(--c-border-bright)",
              color: "var(--c-text-soft)",
              fontFamily: "var(--f-sans)",
              whiteSpace: "nowrap",
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
          placeholder={`Ask ${selectedGM}…`}
          className="flex-1 text-sm rounded-lg px-3.5 py-2.5 transition-all duration-150 focus:outline-none"
          style={{
            background: "var(--c-raised)",
            border: "1px solid var(--c-border-bright)",
            color: "var(--c-text)",
            fontFamily: "var(--f-sans)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = gmColor;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--c-border-bright)";
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || thinking}
          className="shrink-0 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: `${gmColor}22`,
            border: `1px solid ${gmColor}66`,
            color: gmColor,
            fontFamily: "var(--f-sans)",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatWindow;
