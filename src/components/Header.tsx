import type { GMName } from "../data/gms";
import type { DetectedOpening } from "../lib/openingDetection";
import GMSelector from "./GMSelector";
import Menu, { type MenuItem } from "./Menu";

export type AppMode = "play" | "learn";

interface HeaderProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  selectedGM: GMName;
  onSelectGM: (gm: GMName) => void;
  opening: DetectedOpening | null;
  menuItems: MenuItem[];
}

/** The masthead: the name, the opening being played, the two modes, the coaches, and the game menu. */
export default function Header({ mode, onModeChange, selectedGM, onSelectGM, opening, menuItems }: HeaderProps) {
  return (
    <header className="masthead">
      <h1 className="wordmark">
        Ask <em>GM</em>
      </h1>

      {opening && mode === "play" && (
        <p key={opening.name} className="opening-tag type-small soft rise-in" title={`${opening.name} (${opening.eco})`}>
          <span className="num">{opening.eco}</span> {opening.name.split(" — ")[0]}
        </p>
      )}

      <div className="masthead-end">
        <div role="group" aria-label="Mode" className="tabs hidden desk:flex">
          {(["play", "learn"] as const).map((value) => (
            <button key={value} type="button" aria-pressed={mode === value} onClick={() => onModeChange(value)} className="tab">
              {value === "play" ? "Play" : "Learn"}
            </button>
          ))}
        </div>
        <div className="hidden desk:block">
          <GMSelector selected={selectedGM} onSelect={onSelectGM} />
        </div>
        <Menu label="Game menu" items={menuItems} />
      </div>
    </header>
  );
}
