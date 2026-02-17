import { useCallback, useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import PersonalitySelector from "./components/PersonalitySelector";
import ChatWindow from "./components/ChatWindow";
import ChessPanel from "./features/ChessPanel";
import { useStockfish } from "./hooks/useStockfish";

type ChatMessage = { sender: string; text: string };

/**
 * Call the backend /api/chat endpoint which proxies to the Claude API.
 */
async function askGM(payload: {
  selectedGM: string;
  currentFen: string;
  bestMove: string | null;
  question: string;
  conversationHistory: { role: string; content: string }[];
}): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Server error" }));
    throw new Error(err.error || `Server responded with ${res.status}`);
  }

  const data = await res.json();
  return data.response;
}

function App() {
  const [selectedGM, setSelectedGM] = useState("Magnus");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { sender: "GM", text: "Welcome! Ask me anything about this position." },
  ]);
  const [thinking, setThinking] = useState(false);
  const chessRef = useRef(new Chess());
  const [history, setHistory] = useState([chessRef.current.fen()]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [currentFen, setCurrentFen] = useState(chessRef.current.fen());

  // Stockfish analysis (local WASM with Lichess fallback)
  const {
    bestMove,
    analyzePosition,
    thinking: stockfishThinking,
  } = useStockfish();

  // Analyze position whenever the board changes
  useEffect(() => {
    analyzePosition(currentFen);
  }, [currentFen, analyzePosition]);

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

  /**
   * Send the user's question to the Claude API through our backend,
   * along with the full chess context (FEN, Stockfish best move, GM persona).
   */
  const handleQuestion = async (question: string) => {
    setThinking(true);

    // Add user message to chat immediately
    setChatMessages((msgs) => [...msgs, { sender: "You", text: question }]);

    try {
      // Build conversation history from existing messages (skip the welcome message)
      const conversationHistory = chatMessages
        .filter((_, i) => i > 0) // Skip the welcome message
        .map((msg) => ({
          role: msg.sender === "You" ? "You" : "assistant",
          content: msg.text,
        }));

      const response = await askGM({
        selectedGM,
        currentFen,
        bestMove,
        question,
        conversationHistory,
      });

      setChatMessages((msgs) => [
        ...msgs,
        { sender: "GM", text: response },
      ]);
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : "Something went wrong";
      setChatMessages((msgs) => [
        ...msgs,
        { sender: "GM", text: `Error: ${errMsg}` },
      ]);
    } finally {
      setThinking(false);
    }
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
        <h1 className="text-3xl font-bold mb-2">Ask GM</h1>
        <PersonalitySelector selected={selectedGM} onSelect={setSelectedGM} />
        <div className="w-full max-w-[620px]">
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
          {/* Stockfish analysis indicator */}
          {bestMove && (
            <div className="mt-2 text-sm text-zinc-400 text-center">
              Engine suggestion: <span className="text-blue-400 font-mono">{bestMove}</span>
              {stockfishThinking && " (analyzing...)"}
            </div>
          )}
          {stockfishThinking && !bestMove && (
            <div className="mt-2 text-sm text-zinc-500 text-center animate-pulse">
              Analyzing position...
            </div>
          )}
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
