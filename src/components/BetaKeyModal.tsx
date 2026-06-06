import React, { useState, useRef, useEffect } from "react";

interface BetaKeyModalProps {
  onSubmit: (key: string) => void;
}

const BetaKeyModal: React.FC<BetaKeyModalProps> = ({ onSubmit }) => {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError(true);
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.85)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="panel w-full max-w-sm p-6 flex flex-col gap-5"
        style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.8)" }}
      >
        {/* Header */}
        <div className="text-center">
          <h2
            className="text-2xl mb-1"
            style={{
              fontFamily: "var(--f-serif)",
              fontWeight: 600,
              color: "var(--c-gold-bright)",
              letterSpacing: "-0.01em",
            }}
          >
            Ask <em style={{ fontStyle: "italic", color: "var(--c-text)" }}>GM</em>
          </h2>
          <p className="text-sm" style={{ color: "var(--c-text-muted)" }}>
            Enter your beta access code to continue
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            ref={inputRef}
            type="password"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(false); }}
            placeholder="Access code"
            autoComplete="off"
            className="w-full text-sm px-4 py-3 rounded-lg focus:outline-none transition-colors text-center tracking-widest"
            style={{
              background: "var(--c-raised)",
              border: `1px solid ${error ? "var(--c-gm-bobby)" : "var(--c-border-bright)"}`,
              color: "var(--c-text)",
              fontFamily: "var(--f-mono)",
              letterSpacing: "0.2em",
            }}
            onFocus={(e) => {
              if (!error) e.currentTarget.style.borderColor = "var(--c-gold)";
            }}
            onBlur={(e) => {
              if (!error) e.currentTarget.style.borderColor = "var(--c-border-bright)";
            }}
          />
          {error && (
            <p className="text-xs text-center" style={{ color: "var(--c-gm-bobby)" }}>
              Please enter an access code
            </p>
          )}
          <button type="submit" className="btn-primary w-full py-2.5 text-sm">
            Enter
          </button>
        </form>
      </div>
    </div>
  );
};

export default BetaKeyModal;
