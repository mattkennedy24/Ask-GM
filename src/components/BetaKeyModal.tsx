import { useEffect, useId, useRef, useState } from "react";
import type { UnlockResult } from "../hooks/useBetaGate";
import Dialog from "./Dialog";

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
      setShakeKey((key) => key + 1);
      setBusy(false);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }

  return (
    <Dialog
      kicker={
        <p className="wordmark" aria-hidden="true">
          Ask <em>GM</em>
        </p>
      }
      title="Private beta"
      description="Enter your access code to talk to the grandmasters."
      initialFocus={inputRef}
    >
      <form onSubmit={handleSubmit} className="stack" noValidate>
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
            className="field code-input"
            data-reveal={reveal ? "" : undefined}
          />
        </div>

        <p id={errorId} role="alert" className="type-small error">
          {error}
        </p>

        <button type="submit" disabled={busy || code.trim() === ""} className="btn btn-primary">
          {busy ? "Checking…" : "Enter"}
        </button>
        <button type="button" onClick={() => setReveal((value) => !value)} className="btn btn-quiet">
          {reveal ? "Hide code" : "Show code"}
        </button>
      </form>
    </Dialog>
  );
}
