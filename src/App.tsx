import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import type { Arrow, Square } from "react-chessboard/dist/chessboard/types";
import PersonalitySelector from "./components/PersonalitySelector";
import ChatWindow from "./components/ChatWindow";
import ChessPanel from "./features/ChessPanel";
import OpeningsPanel from "./components/OpeningsPanel";
import { useStockfish } from "./hooks/useStockfish";
import type { Opening } from "./data/openings";

type ChatMessage = { sender: string; text: string };
type AppTab = "game" | "openings";

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
    headers: {
      "Content-Type": "application/json",
      "X-Beta-Key": localStorage.getItem("betaKey") ?? "",
    },
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
  const [activeTab, setActiveTab] = useState<AppTab>("game");
  const [selectedGM, setSelectedGM] = useState("Magnus");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { sender: "GM", text: "Welcome! Ask me anything about this position." },
  ]);
  const [thinking, setThinking] = useState(false);
  const chessRef = useRef(new Chess());
  const [history, setHistory] = useState([chessRef.current.fen()]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [currentFen, setCurrentFen] = useState(chessRef.current.fen());
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  // Opening lesson mode state
  const [activeOpening, setActiveOpening] = useState<Opening | null>(null);
  const [openingStep, setOpeningStep] = useState(-1);
  const [openingFen, setOpeningFen] = useState<string | null>(null);

  // Prompt for beta access key on first visit
  useEffect(() => {
    if (!localStorage.getItem("betaKey")) {
      const key = window.prompt("Enter beta access code:");
      if (key) localStorage.setItem("betaKey", key);
    }
  }, []);

  // Stockfish analysis (local WASM with Lichess fallback)
  const {
    bestMove,
    evalScore,
    mateIn,
    pvLine,
    analyzePosition,
    thinking: stockfishThinking,
  } = useStockfish();

  // The FEN to analyse: when in opening lesson, analyse the lesson position
  const fenToAnalyse = activeTab === "openings" && openingFen ? openingFen : currentFen;

  // Analyze position whenever the board changes
  useEffect(() => {
    analyzePosition(fenToAnalyse);
  }, [fenToAnalyse, analyzePosition]);

  const derivedChess = useMemo(() => new Chess(currentFen), [currentFen]);
  const inCheck = derivedChess.inCheck();

  const kingInCheckSquare = useMemo((): string | null => {
    if (!inCheck) return null;
    const squares = derivedChess.findPiece({ type: "k", color: derivedChess.turn() });
    return squares.length > 0 ? squares[0] : null;
  }, [derivedChess, inCheck]);

  const engineArrow = useMemo((): Arrow | null => {
    if (!bestMove || bestMove.length < 4) return null;
    const from = bestMove.slice(0, 2);
    const to = bestMove.slice(2, 4);
    if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) return null;
    return [from as Square, to as Square, "rgba(0, 160, 0, 0.8)"];
  }, [bestMove]);

  const loadFenAt = useCallback(
    (index: number) => {
      const boundedIndex = Math.min(Math.max(index, 0), history.length - 1);
      const fen = history[boundedIndex];
      chessRef.current.load(fen);
      setHistoryIndex(boundedIndex);
      setCurrentFen(fen);
      setLastMove(null);
    },
    [history],
  );

  const handleMove = (from: string, to: string, promotion?: string): boolean => {
    const move = chessRef.current.move({ from, to, promotion: promotion ?? "q" });
    if (!move) return false;
    setLastMove({ from, to });
    const fen = chessRef.current.fen();
    const nextHistory = history.slice(0, historyIndex + 1).concat(fen);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
    setCurrentFen(fen);
    return true;
  };

  const handleBack = useCallback(() => {
    if (historyIndex > 0) loadFenAt(historyIndex - 1);
  }, [historyIndex, loadFenAt]);

  const handleForward = useCallback(() => {
    if (historyIndex < history.length - 1) loadFenAt(historyIndex + 1);
  }, [history.length, historyIndex, loadFenAt]);

  const handleUndo = useCallback(() => handleBack(), [handleBack]);

  /**
   * Send the user's question to Claude through our backend.
   */
  const handleQuestion = async (question: string) => {
    setThinking(true);
    setChatMessages((msgs) => [...msgs, { sender: "You", text: question }]);

    // Build context: use opening FEN if in lesson mode, otherwise game FEN
    const contextFen = activeTab === "openings" && openingFen ? openingFen : currentFen;
    const contextBestMove = bestMove;

    // Add opening context if relevant
    const openingContext =
      activeOpening && activeTab === "openings"
        ? `We are studying the ${activeOpening.name} (ECO ${activeOpening.eco}). `
        : "";

    const enrichedQuestion = openingContext ? openingContext + question : question;

    try {
      const conversationHistory = chatMessages
        .filter((_, i) => i > 0)
        .map((msg) => ({
          role: msg.sender === "You" ? "You" : "assistant",
          content: msg.text,
        }));

      const response = await askGM({
        selectedGM,
        currentFen: contextFen,
        bestMove: contextBestMove,
        question: enrichedQuestion,
        conversationHistory,
      });

      setChatMessages((msgs) => [...msgs, { sender: "GM", text: response }]);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Something went wrong";
      setChatMessages((msgs) => [...msgs, { sender: "GM", text: `Error: ${errMsg}` }]);
    } finally {
      setThinking(false);
    }
  };

  const handleQuickAsk = () => handleQuestion("What should I play here?");

  // Opening lesson callbacks
  const handleOpeningPositionChange = useCallback(
    (fen: string, _moveIndex: number, opening: Opening) => {
      setOpeningFen(fen);
      setActiveOpening(opening);
    },
    []
  );

  const handleSelectOpening = useCallback((opening: Opening) => {
    setActiveOpening(opening);
    setOpeningStep(-1);
    setOpeningFen(null);
    // Greet the user with context
    setChatMessages([
      {
        sender: "GM",
        text: `Let's study the ${opening.name}! Use the controls below the board to step through the moves. Ask me anything about this opening.`,
      },
    ]);
  }, []);

  const handleExitOpeningLesson = useCallback(() => {
    setActiveOpening(null);
    setOpeningStep(-1);
    setOpeningFen(null);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isEditable =
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        target?.isContentEditable;
      if (isEditable) return;

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

  // Which FEN to display on the board
  const displayFen = activeTab === "openings" && openingFen ? openingFen : currentFen;

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
      {/* ── Top navigation bar ── */}
      <header className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-700 shrink-0">
        <h1 className="text-xl font-bold tracking-tight">Ask GM</h1>
        <div className="flex items-center gap-2">
          {/* Tab buttons */}
          <button
            onClick={() => setActiveTab("game")}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === "game"
                ? "bg-blue-600 text-white"
                : "text-zinc-400 hover:text-white hover:bg-zinc-700"
            }`}
          >
            ♟ Game
          </button>
          <button
            onClick={() => { setActiveTab("openings"); }}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === "openings"
                ? "bg-blue-600 text-white"
                : "text-zinc-400 hover:text-white hover:bg-zinc-700"
            }`}
          >
            📖 Openings
          </button>
          <PersonalitySelector selected={selectedGM} onSelect={setSelectedGM} />
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col md:flex-row gap-3 p-3 overflow-hidden min-h-0">
        {/* Left: Chess board area */}
        <div className="flex flex-col items-center md:overflow-y-auto md:flex-1 min-w-0">
          <div className="w-full max-w-[620px]">
            <ChessPanel
              position={displayFen}
              onMove={handleMove}
              onBack={handleBack}
              onForward={handleForward}
              onUndo={handleUndo}
              onAsk={handleQuickAsk}
              selectedGM={selectedGM}
              disableForward={historyIndex >= history.length - 1}
              lastMove={lastMove}
              inCheck={inCheck}
              kingInCheckSquare={kingInCheckSquare}
              engineArrow={engineArrow}
              evalScore={evalScore}
              mateIn={mateIn}
              engineThinking={stockfishThinking}
              pvLine={pvLine}
            />
          </div>
        </div>

        {/* Right: Chat + Openings panel */}
        <div className="w-full md:w-[380px] flex flex-col min-h-0 h-[45vh] md:h-full shrink-0">
          {/* Openings panel (shown above chat when in openings tab) */}
          {activeTab === "openings" && (
            <div className="flex-1 min-h-0 border-4 border-zinc-600 rounded-xl p-4 bg-zinc-800 mb-3 overflow-hidden">
              <OpeningsPanel
                onPositionChange={handleOpeningPositionChange}
                onExit={handleExitOpeningLesson}
                currentStep={openingStep}
                onStepChange={setOpeningStep}
                activeOpening={activeOpening}
                onSelectOpening={handleSelectOpening}
              />
            </div>
          )}

          {/* Chat window — always visible */}
          <div className={`${activeTab === "openings" ? "h-[200px] shrink-0" : "flex-1 min-h-0"}`}>
            <ChatWindow
              messages={chatMessages}
              onSubmit={handleQuestion}
              thinking={thinking}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
