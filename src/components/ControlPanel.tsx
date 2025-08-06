import React from "react";

interface ControlPanelProps {
  onAnalyze: () => void;
  onReset: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ onAnalyze, onReset }) => {
  return (
    <div className="flex gap-4 justify-center mt-4">
        <button
          className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors duration-200 shadow"
          onClick={onAnalyze}
        >
          Analyze Position
        </button>
        <button
          className="px-6 py-2 rounded-lg bg-gray-900 text-white font-semibold hover:bg-zinc-800 transition-colors duration-200 shadow"
          onClick={onReset}
        >
          Reset
        </button>
    </div>
  );
};

export default ControlPanel;
