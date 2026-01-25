import React from "react";

const personalities = ["Magnus", "Hikaru", "Bobby"];

interface PersonalitySelectorProps {
  selected: string;
  onSelect: (name: string) => void;
}

const PersonalitySelector: React.FC<PersonalitySelectorProps> = ({ selected, onSelect }) => {
  return (
    <div className="flex flex-col items-center gap-2 mb-4 w-full max-w-[320px]">
      <label className="text-sm font-semibold text-zinc-300" htmlFor="gm-selector">
        Select GM Persona
      </label>
      <select
        id="gm-selector"
        className="w-full rounded-lg bg-gray-900 text-white px-4 py-2 border border-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={selected}
        onChange={(event) => onSelect(event.target.value)}
      >
        {personalities.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default PersonalitySelector;
