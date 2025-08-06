import React, { useState } from "react";
import ChessBoard from "./components/ChessBoard";
import PersonalitySelector from "./components/PersonalitySelector";
import MoveAnalysis from "./components/MoveAnalysis";
import ControlPanel from "./components/ControlPanel";
import ChatWindow from "./components/ChatWindow";
import ChessPanel from "./features/ChessPanel";

function App() {
  const [selectedGM, setSelectedGM] = useState("Magnus");
  const [move, setMove] = useState("");
  const [explanation, setExplanation] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { sender: "GM", text: "Welcome! Ask me anything about this position." },
  ]);
  const [thinking, setThinking] = useState(false);

  const handleAnalyze = () => {
    setMove("Nf3");
    setExplanation(
      `${selectedGM} says: This keeps pressure while simplifying the position.`
    );
  };

  const handleReset = () => {
    setMove("");
    setExplanation("");
    // Add chessboard reset logic here
  };

  const handleQuestion = async (question: string) => {
    // Placeholder: log FEN, selectedGM, question
    setThinking(true);
    setChatMessages((msgs) => [
      ...msgs,
      { sender: "You", text: question },
    ]);
    // Simulate GPT response
    setTimeout(() => {
      setChatMessages((msgs) => [
        ...msgs,
        { sender: "GM", text: `(${selectedGM}): That's a great question! [Sample answer here.]` },
      ]);
      setThinking(false);
    }, 1100); // Simulate thinking time, 1.1 seconds
  };

  return (
      <div className="min-h-screen bg-zinc-900 text-white p-4 flex flex-col md:flex-row gap-4">
      <div className="flex-1 flex flex-col items-center">
        <h1 className="text-3xl font-bold mb-2">Ask GM ♟️</h1>
        <PersonalitySelector selected={selectedGM} onSelect={setSelectedGM} />
        <div className="w-full max-w-[480px]">
          <ChessPanel
            position=""
            onMove={() => { }}
            onBack={() => { }}
            onForward={() => { }}
            onUndo={() => { }}
            onAsk={handleAnalyze}
            selectedGM={selectedGM}
            disableForward={true}
          />
        </div>
      </div>
      <div className="w-full md:w-[400px] flex flex-col">
        <ChatWindow
          messages={chatMessages}
          onSubmit={handleQuestion}
          thinking={thinking}
        />
      </div>
    </div>
  );
}

export default App;
