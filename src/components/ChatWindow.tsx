import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { GMS, type GMName } from "../data/gms";
import type { ChatMessage } from "../hooks/useChat";
import type { ResolvedMove } from "../lib/chessMoves";
import { tokenizeChessText } from "../lib/chessText";
import { Check, Retry, Send } from "./icons";

interface ChatWindowProps {
  gm: GMName;
  messages: ChatMessage[];
  /** This grandmaster is composing a reply. */
  thinking: boolean;
  /** Some question is in flight (maybe to another grandmaster), so a new one must wait. */
  busy: boolean;
  onSend: (question: string) => void;
  onRetry: (messageId: string) => void;
  /**
   * The position a suggested move may be played on, or null when the board cannot take moves
   * (opening lessons). A move is only clickable in a reply that was written for exactly this position.
   */
  playableFen: string | null;
  onPlayMove: (move: ResolvedMove) => void;
  /** Name of the opening on the board, for the "Explain …" shortcut. */
  openingName: string | null;
  /** Rendered under the header — the grandmaster picker on phones. */
  headerExtra?: ReactNode;
}

const QUICK_ASKS = ["Best move?", "Explain the plan", "What did I do wrong?", "Why this engine move?"];

function Reply({ text, fen, playableFen, onPlayMove }: { text: string; fen: string; playableFen: string | null; onPlayMove: (move: ResolvedMove) => void }) {
  const segments = useMemo(() => tokenizeChessText(text, fen || undefined), [text, fen]);
  return (
    <>
      {segments.map((segment, i) => {
        if (segment.kind === "text") return segment.text;
        const { move } = segment;
        if (move && playableFen !== null && fen === playableFen) {
          return (
            <button key={i} type="button" className="move-token" onClick={() => onPlayMove(move)} title={`Play ${move.san} on the board`} aria-label={`Play ${move.san}`}>
              {segment.text}
            </button>
          );
        }
        return (
          <span key={i} className="move-token">
            {segment.text}
          </span>
        );
      })}
    </>
  );
}

export default function ChatWindow({ gm, messages, thinking, busy, onSend, onRetry, playableFen, onPlayMove, openingName, headerExtra }: ChatWindowProps) {
  const profile = GMS[gm];
  const [draft, setDraft] = useState("");
  const [justSent, setJustSent] = useState(false);
  const [pulse, setPulse] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousCount = useRef(messages.length);

  // Keep the newest message in view by scrolling the log itself (never the page).
  useEffect(() => {
    const log = logRef.current;
    log?.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  }, [messages.length, thinking, gm]);

  // Flash a check mark on the send button for a moment after sending.
  useEffect(() => {
    if (!justSent) return;
    const timer = setTimeout(() => setJustSent(false), 700);
    return () => clearTimeout(timer);
  }, [justSent]);

  // The avatar pulses when this grandmaster answers.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const last = messages[messages.length - 1];
    if (messages.length > previousCount.current && last?.role === "gm" && !last.kind) {
      setPulse(true);
      timer = setTimeout(() => setPulse(false), 400);
    }
    previousCount.current = messages.length;
    return () => clearTimeout(timer);
  }, [messages]);

  const lastReply = [...messages].reverse().find((m) => m.role === "gm" && !m.kind);
  const lastMessage = messages[messages.length - 1];
  const showFollowUps = !thinking && lastMessage === lastReply && (lastReply?.followUps?.length ?? 0) > 0;

  function submit(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    onSend(text);
    setDraft("");
    setJustSent(true);
    inputRef.current?.focus();
  }

  const shortcuts = [...(openingName ? [`Explain the ${openingName}`] : []), ...QUICK_ASKS];

  return (
    <section aria-label={`Chat with ${profile.fullName}`} className="panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0" style={{ borderBottom: "1px solid var(--c-border)" }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <span
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${pulse ? "avatar-pulse" : ""}`}
            style={{
              background: "color-mix(in srgb, var(--gm) 16%, transparent)",
              border: "1.5px solid color-mix(in srgb, var(--gm) 55%, transparent)",
              color: "var(--gm)",
              fontFamily: "var(--f-mono)",
              fontSize: "0.6875rem",
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
            aria-hidden="true"
          >
            {profile.initials}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold leading-tight">{profile.fullName}</h2>
            <p className="truncate text-xs leading-tight" style={{ color: "var(--c-text-muted)" }}>
              {profile.subtitle}
            </p>
          </div>
        </div>
        {headerExtra && <div className="px-3 pb-3">{headerExtra}</div>}
      </div>

      <div ref={logRef} role="log" aria-live="polite" aria-relevant="additions" className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {messages.map((message) => {
          if (message.role === "user") {
            return (
              <div key={message.id} className="msg-in flex justify-end">
                <p className="bubble bubble-user max-w-[88%]" style={{ whiteSpace: "pre-wrap" }}>
                  {message.text}
                </p>
              </div>
            );
          }

          if (message.kind === "note") {
            return (
              <p key={message.id} className="msg-in px-4 py-1 text-center text-xs" style={{ color: "var(--c-text-muted)" }}>
                {message.text}
              </p>
            );
          }

          if (message.kind === "error") {
            return (
              <div key={message.id} className="msg-in flex justify-start">
                <div className="bubble bubble-error max-w-[88%]" role="alert">
                  <p>{message.text}</p>
                  {message.retry && (
                    <button type="button" className="btn mt-2" onClick={() => onRetry(message.id)} disabled={busy}>
                      <Retry size={14} /> Try again
                    </button>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div key={message.id} className="msg-in flex max-w-[88%] flex-col items-start gap-2">
              <div className="flex min-w-0">
                <span className="mr-2.5 mt-1 w-0.5 shrink-0 self-stretch rounded-full" style={{ background: "var(--gm)", minHeight: "1rem" }} aria-hidden="true" />
                <p className="bubble bubble-gm min-w-0" style={{ whiteSpace: "pre-wrap" }}>
                  <Reply text={message.text} fen={message.fen} playableFen={playableFen} onPlayMove={onPlayMove} />
                </p>
              </div>
              {showFollowUps && message === lastReply && (
                <div className="flex flex-wrap gap-1.5 pl-3">
                  {message.followUps?.map((question, i) => (
                    <button key={question} type="button" className="chip chip-gm chip-in" disabled={busy} onClick={() => submit(question)} style={{ animationDelay: `${i * 70}ms`, whiteSpace: "normal", textAlign: "left" }}>
                      {question}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {thinking && (
          <div className="flex justify-start" role="status" aria-label={`${profile.name} is thinking`}>
            <span className="mr-2.5 w-0.5 shrink-0 self-stretch rounded-full" style={{ background: "var(--gm)", minHeight: "2rem" }} aria-hidden="true" />
            <div className="bubble bubble-gm flex items-center gap-1.5 !py-3">
              {[0, 1, 2].map((i) => (
                <span key={i} className="thinking-bar inline-block rounded-full" style={{ width: 5, height: 14, background: "var(--gm)", opacity: 0.8 }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex shrink-0 gap-1.5 overflow-x-auto px-3 pb-1.5 pt-2" style={{ borderTop: "1px solid var(--c-border)", scrollbarWidth: "none" }}>
        {shortcuts.map((question, i) => (
          <button key={question} type="button" className={`chip ${openingName && i === 0 ? "chip-accent" : ""}`} disabled={busy} onClick={() => submit(question)}>
            {question}
          </button>
        ))}
      </div>

      <form
        className="flex shrink-0 gap-2 px-3 pb-3 pt-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          submit(draft);
        }}
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={thinking ? `${profile.name} is thinking…` : `Ask ${profile.name}…`}
          aria-label={`Ask ${profile.fullName} a question`}
          maxLength={1000}
          autoComplete="off"
          enterKeyHint="send"
          className="field min-w-0 flex-1"
        />
        <button type="submit" className="btn btn-gm shrink-0 !px-4" disabled={!draft.trim() || busy} aria-label="Send" style={{ minWidth: "3rem", minHeight: "2.75rem" }}>
          {justSent ? <Check size={18} /> : <Send size={18} />}
        </button>
      </form>
    </section>
  );
}
