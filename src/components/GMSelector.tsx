import { GM_NAMES, GMS, type GMName } from "../data/gms";

interface GMSelectorProps {
  selected: GMName;
  onSelect: (gm: GMName) => void;
  /** Spread the three coaches across the full width (the phone's chat header) instead of hugging the content. */
  fill?: boolean;
}

/** Pick which grandmaster you are talking to. Each one wears their own ink. */
export default function GMSelector({ selected, onSelect, fill = false }: GMSelectorProps) {
  return (
    <div role="group" aria-label="Choose your grandmaster" className={`gm-picker ${fill ? "gm-picker-fill" : ""}`}>
      {GM_NAMES.map((name) => {
        const gm = GMS[name];
        return (
          <button
            key={name}
            type="button"
            aria-pressed={selected === name}
            onClick={() => onSelect(name)}
            title={`${gm.fullName}: ${gm.subtitle}`}
            className="gm-pick"
            data-gm={name}
          >
            <span className="avatar" aria-hidden="true">
              {gm.initials}
            </span>
            {name}
          </button>
        );
      })}
    </div>
  );
}
