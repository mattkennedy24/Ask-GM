import React from "react";

const personalities = ["Magnus", "Hikaru", "Bobby"];

interface PersonalitySelectorProps {
  selected: string;
  onSelect: (name: string) => void;
}

const PersonalitySelector: React.FC<PersonalitySelectorProps> = ({ selected, onSelect }) => {
  return (
    <div className="flex gap-4 justify-center mb-4">
      {personalities.map((name) => (
        <button
          key={name}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors duration-200 bg-zinc-700 text-white hover:bg-zinc-600 ${selected === name ? "border-2 border-blue-500" : ""}`}
          onClick={() => onSelect(name)}
        >
          {name}
        </button>
      ))}
    </div>
  );
};

export default PersonalitySelector;
