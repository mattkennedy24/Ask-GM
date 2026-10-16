import { GM_NAMES, GMS, type GMName } from "../data/gms";

interface GMSelectorProps {
  selected: GMName;
  onSelect: (gm: GMName) => void;
  /** Stretch to fill the row (mobile) instead of hugging its content (desktop header). */
  fill?: boolean;
  disabled?: boolean;
}

/** Pick which grandmaster you are talking to. */
export default function GMSelector({ selected, onSelect, fill = false, disabled = false }: GMSelectorProps) {
  return (
    <div role="group" aria-label="Choose your grandmaster" className="seg" style={{ width: fill ? "100%" : undefined }}>
      {GM_NAMES.map((name) => {
        const gm = GMS[name];
        return (
          <button
            key={name}
            type="button"
            aria-pressed={selected === name}
            disabled={disabled}
            onClick={() => onSelect(name)}
            title={`${gm.fullName} — ${gm.subtitle}`}
            className="seg-item seg-gm"
            style={{ ["--seg-color" as string]: gm.color }}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}
