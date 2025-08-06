import React from "react";

interface MoveAnalysisProps {
  move: string;
  explanation: string;
}

const MoveAnalysis: React.FC<MoveAnalysisProps> = ({ move, explanation }) => {
  return (
    <div className="bg-gray-900 text-white rounded-lg p-4 shadow-md mt-4">
      <h2 className="text-lg font-bold mb-2">Best Move: <span className="text-blue-400">{move}</span></h2>
      <p className="italic">{explanation}</p>
    </div>
  );
};

export default MoveAnalysis;
