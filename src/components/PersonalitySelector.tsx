import React from "react";

const PERSONALITIES = [
  { name: "Magnus", color: "var(--c-gm-magnus)", short: "Magnus" },
  { name: "Hikaru", color: "var(--c-gm-hikaru)", short: "Hikaru" },
  { name: "Bobby",  color: "var(--c-gm-bobby)",  short: "Bobby"  },
];

interface PersonalitySelectorProps {
  selected: string;
  onSelect: (name: string) => void;
}

const PersonalitySelector: React.FC<PersonalitySelectorProps> = ({ selected, onSelect }) => {
  return (
    <div className="flex items-center gap-1">
      {PERSONALITIES.map(({ name, color, short }) => {
        const isActive = selected === name;
        return (
          <button
            key={name}
            onClick={() => onSelect(name)}
            className="relative px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 focus:outline-none"
            style={{
              background: isActive ? `${color}18` : "transparent",
              border: `1px solid ${isActive ? color : "var(--c-border-mid)"}`,
              color: isActive ? color : "var(--c-text-soft)",
              fontFamily: "var(--f-sans)",
              letterSpacing: "0.01em",
            }}
            title={`Switch to ${name}`}
          >
            {short}
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
