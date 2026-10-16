import { useEffect, useId, useRef, useState } from "react";
import type { UnlockResult } from "../hooks/useBetaGate";
import { Lock } from "./icons";

interface BetaKeyModalProps {
  /** Asks the server to verify the code; resolves with the outcome. */
  onUnlock: (code: string) => Promise<UnlockResult>;
}

/**
 * Access-code prompt for the private beta. The code is checked by the server
 * before this dialog goes away, and a wrong code says so.
 */
export default function BetaKeyModal({ onUnlock }: BetaKeyModalProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    const result = await onUnlock(code);
    // On success the gate closes and this component unmounts.
    if (!result.ok) {
      setError(result.error ?? "That access code isn't valid.");
      setShakeKey((k) => k + 1);
      setBusy(false);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.82)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="panel flex w-full max-w-sm flex-col gap-5 p-6"
        style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.8)" }}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <span
            className="inline-flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: "var(--c-gold-dim)", color: "var(--c-gold-bright)" }}
          >
            <Lock size={18} />
          </span>
          <h2
            id={titleId}
            className="text-2xl"
            style={{ fontFamily: "var(--f-serif)", fontWeight: 600, color: "var(--c-gold-bright)", letterSpacing: "-0.01em" }}
          >
            Ask <em style={{ fontStyle: "italic", color: "var(--c-text)" }}>GM</em>
          </h2>
          <p id={descriptionId} className="text-sm" style={{ color: "var(--c-text-soft)" }}>
            This is a private beta. Enter your access code to talk to the grandmasters.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
          <div key={shakeKey} className={shakeKey > 0 ? "shake" : undefined}>
            <input
              ref={inputRef}
              type={reveal ? "text" : "password"}
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                if (error) setError(null);
              }}
              placeholder="Access code"
              aria-label="Access code"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              disabled={busy}
              className="field text-center"
              style={{ fontFamily: "var(--f-mono)", letterSpacing: reveal ? "0.05em" : "0.2em", ["--gm" as string]: "var(--c-gold)" }}
            />
          </div>

          <p id={errorId} role="alert" className="min-h-5 text-center text-sm" style={{ color: "var(--c-danger)" }}>
            {error}
          </p>

          <button type="submit" disabled={busy || code.trim() === ""} className="btn btn-primary w-full" style={{ minHeight: "2.75rem" }}>
            {busy ? "Checking…" : "Enter"}
          </button>
          <button type="button" onClick={() => setReveal((r) => !r)} className="text-xs underline-offset-2 hover:underline" style={{ color: "var(--c-text-muted)" }}>
            {reveal ? "Hide code" : "Show code"}
          </button>
        </form>
      </div>
    </div>
  );
}
