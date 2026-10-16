import type { GMName } from "../data/gms";
import type { DetectedOpening } from "../lib/openingDetection";
import GMSelector from "./GMSelector";

export type AppMode = "play" | "learn";

interface HeaderProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  selectedGM: GMName;
  onSelectGM: (gm: GMName) => void;
  opening: DetectedOpening | null;
}

export default function Header({ mode, onModeChange, selectedGM, onSelectGM, opening }: HeaderProps) {
  return (
    <header
      className="flex shrink-0 items-center gap-3 px-4 py-2.5"
      style={{ background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)" }}
    >
      <h1
        className="shrink-0 select-none text-xl leading-none"
        style={{ fontFamily: "var(--f-serif)", fontWeight: 600, color: "var(--c-gold-bright)", letterSpacing: "-0.01em" }}
      >
        Ask <em style={{ fontStyle: "italic", color: "var(--c-text)" }}>GM</em>
      </h1>

      {opening && mode === "play" && (
        <span
          key={opening.name}
          className="chip chip-accent badge-in min-w-0 truncate"
          style={{ flex: "0 1 auto", minHeight: "1.75rem", fontFamily: "var(--f-mono)", fontSize: "0.6875rem" }}
          title={`${opening.name} (${opening.eco})`}
        >
          <span style={{ opacity: 0.65 }}>{opening.eco}</span> {opening.name.split(" — ")[0]}
        </span>
      )}

      <div className="ml-auto hidden items-center gap-3 desk:flex">
        <div role="group" aria-label="Mode" className="seg">
          {(["play", "learn"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => onModeChange(value)}
              className="seg-item"
              style={{ minWidth: "4.5rem" }}
            >
              {value === "play" ? "Play" : "Learn"}
            </button>
          ))}
        </div>
        <GMSelector selected={selectedGM} onSelect={onSelectGM} />
      </div>
    </header>
  );
}
