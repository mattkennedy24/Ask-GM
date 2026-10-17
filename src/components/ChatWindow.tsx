import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { GMS, type GMName } from "../data/gms";
import type { ChatMessage } from "../hooks/useChat";
import type { ResolvedMove } from "../lib/chessMoves";
import { tokenizeChessText } from "../lib/chessText";
import { ArrowRight, Check, Retry } from "./icons";

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
  /** Ready-made questions for the position on screen. */
  quickAsks: string[];
  /** Rendered under the header: the grandmaster picker on phones. */
  headerExtra?: ReactNode;
}

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

export default function ChatWindow({ gm, messages, thinking, busy, onSend, onRetry, playableFen, onPlayMove, quickAsks, headerExtra }: ChatWindowProps) {
  const profile = GMS[gm];
  const [draft, setDraft] = useState("");
  const [justSent, setJustSent] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <section aria-label={`Chat with ${profile.fullName}`} className="chat">
      <div className="chat-head">
        <div className="chat-who">
          <span className="avatar avatar-lg" aria-hidden="true">
            {profile.initials}
          </span>
          <div className="min-w-0">
            <h2 className="type-title truncate">{profile.fullName}</h2>
            <p className="type-small muted truncate">{profile.subtitle}</p>
          </div>
        </div>
        {headerExtra}
      </div>

      <div ref={logRef} role="log" aria-live="polite" aria-relevant="additions" className="chat-log">
        {messages.map((message) => {
          if (message.role === "user") {
            return (
              <p key={message.id} className="msg-user rise-in">
                {message.text}
              </p>
            );
          }

          if (message.kind === "note") {
            return (
              <p key={message.id} className="msg-note type-small muted rise-in">
                {message.text}
              </p>
            );
          }

          if (message.kind === "error") {
            return (
              <div key={message.id} className="msg-error rise-in" role="alert">
                <p className="type-small">{message.text}</p>
                {message.retry && (
                  <button type="button" className="btn" onClick={() => onRetry(message.id)} disabled={busy}>
                    <Retry size={16} /> Try again
                  </button>
                )}
              </div>
            );
          }

          return (
            <div key={message.id} className="msg-gm-wrap rise-in">
              <p className="msg-gm">
                <Reply text={message.text} fen={message.fen} playableFen={playableFen} onPlayMove={onPlayMove} />
              </p>
              {showFollowUps && message === lastReply && (
                <div className="followups">
                  {message.followUps?.map((question, i) => (
                    <button key={question} type="button" className="chip chip-gm rise-in" disabled={busy} onClick={() => submit(question)} style={{ animationDelay: `${i * 70}ms` }}>
                      {question}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {thinking && (
          <p className="msg-gm msg-thinking" role="status" aria-label={`${profile.name} is thinking`}>
            <span className="dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </p>
        )}
      </div>

      <div className="quick-asks">
        {quickAsks.map((question) => (
          <button key={question} type="button" className="chip" disabled={busy} onClick={() => submit(question)}>
            {question}
          </button>
        ))}
      </div>

      <form
        className="composer"
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
          className="field"
        />
        <button type="submit" className="btn btn-primary btn-send" disabled={!draft.trim() || busy} aria-label="Send">
          {justSent ? <Check size={20} /> : <ArrowRight size={20} />}
        </button>
      </form>
    </section>
  );
}
