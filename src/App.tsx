import React, { useCallback, useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import PersonalitySelector from "./components/PersonalitySelector";
import ChatWindow from "./components/ChatWindow";
import ChessPanel from "./features/ChessPanel";

function App() {
  const [selectedGM, setSelectedGM] = useState("Magnus");
  const [chatMessages, setChatMessages] = useState([
    { sender: "GM", text: "Welcome! Ask me anything about this position." },
  ]);
  const [thinking, setThinking] = useState(false);
  const chessRef = useRef(new Chess());
  const [history, setHistory] = useState([chessRef.current.fen()]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [currentFen, setCurrentFen] = useState(chessRef.current.fen());

  const loadFenAt = useCallback(
    (index: number) => {
      const boundedIndex = Math.min(Math.max(index, 0), history.length - 1);
      const fen = history[boundedIndex];
      chessRef.current.load(fen);
      setHistoryIndex(boundedIndex);
      setCurrentFen(fen);
    },
    [history],
  );

  const handleMove = (from: string, to: string) => {
    const move = chessRef.current.move({ from, to, promotion: "q" });
    if (!move) {
      return false;
    }
    const fen = chessRef.current.fen();
    const nextHistory = history.slice(0, historyIndex + 1).concat(fen);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
    setCurrentFen(fen);
    return true;
  };

  const handleBack = useCallback(() => {
    if (historyIndex > 0) {
      loadFenAt(historyIndex - 1);
    }
  }, [historyIndex, loadFenAt]);

  const handleForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      loadFenAt(historyIndex + 1);
    }
  }, [history.length, historyIndex, loadFenAt]);

  const handleUndo = useCallback(() => {
    handleBack();
  }, [handleBack]);

  const handleQuestion = (question: string) => {
    setThinking(true);

    setChatMessages((msgs) => [
      ...msgs,
      { sender: "You", text: question },
    ]);

    window.setTimeout(() => {
      setChatMessages((msgs) => [
        ...msgs,
        {
          sender: "GM",
          text: "GM Conversation is not yet fully implemented.",
        },
      ]);
      setThinking(false);
    }, 500);
  };

  const handleQuickAsk = () => {
    handleQuestion("What should I play here?");
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isEditable =
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        target?.isContentEditable;

      if (isEditable) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handleBack();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        handleForward();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleBack, handleForward]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col md:flex-row gap-4">
      <div className="flex-1 flex flex-col items-center">
        <h1 className="text-3xl font-bold mb-2">Ask GM ♟️</h1>
        <PersonalitySelector selected={selectedGM} onSelect={setSelectedGM} />
        <div className="w-full max-w-[480px]">
          <ChessPanel
            position={currentFen}
            onMove={handleMove}
            onBack={handleBack}
            onForward={handleForward}
            onUndo={handleUndo}
            onAsk={handleQuickAsk}
            selectedGM={selectedGM}
            disableForward={historyIndex >= history.length - 1}
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
