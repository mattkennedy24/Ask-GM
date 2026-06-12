import React from "react";

const PERSONALITIES = [
  {
    name: "Magnus",
    full: "Magnus Carlsen",
    color: "var(--c-gm-magnus)",
    subtitle: "Norwegian World Champion",
  },
  {
    name: "Hikaru",
    full: "Hikaru Nakamura",
    color: "var(--c-gm-hikaru)",
    subtitle: "American Speed Chess Legend",
  },
  {
    name: "Bobby",
    full: "Bobby Fischer",
    color: "var(--c-gm-bobby)",
    subtitle: "11th World Champion",
  },
];

interface PersonalitySelectorProps {
  selected: string;
  onSelect: (name: string) => void;
}

const PersonalitySelector: React.FC<PersonalitySelectorProps> = ({ selected, onSelect }) => {
  return (
    <div className="flex items-center gap-1">
      {PERSONALITIES.map(({ name, full, color, subtitle }) => {
        const isActive = selected === name;
        return (
          <button
            key={name}
            onClick={() => onSelect(name)}
            className="relative px-3 py-1.5 rounded-lg text-sm font-medium focus:outline-none group"
            style={{
              background: isActive ? `${color}18` : "transparent",
              border: `1px solid ${isActive ? color : "var(--c-border-mid)"}`,
              color: isActive ? color : "var(--c-text-soft)",
              fontFamily: "var(--f-sans)",
              letterSpacing: "0.01em",
              transition: "background 150ms ease, border-color 150ms ease, color 150ms ease, box-shadow 150ms ease",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = `${color}66`;
                (e.currentTarget as HTMLButtonElement).style.color = color;
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--c-border-mid)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--c-text-soft)";
              }
            }}
            title={`${full} — ${subtitle}`}
          >
            {name}
            {isActive && (
              <span
                className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                style={{ background: color }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default PersonalitySelector;
