import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import type { Arrow, Square } from "react-chessboard/dist/chessboard/types";
import PersonalitySelector from "./components/PersonalitySelector";
import ChatWindow from "./components/ChatWindow";
import ChessPanel from "./features/ChessPanel";
import OpeningsPanel from "./components/OpeningsPanel";
import { useStockfish } from "./hooks/useStockfish";
import type { EngineLineResult } from "./hooks/useStockfish";
import type { Opening } from "./data/openings";

type ChatMessage = { sender: string; text: string };
type AppTab = "game" | "openings";

async function askGM(payload: {
  selectedGM: string;
  currentFen: string;
  question: string;
  conversationHistory: { role: string; content: string }[];
  moveHistory?: string[];
  topLines?: EngineLineResult[];
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
    { sender: "GM", text: "Welcome. Make a move and ask me anything about the position." },
  ]);
  const [thinking, setThinking] = useState(false);
  const chessRef = useRef(new Chess());
  const [history, setHistory] = useState([chessRef.current.fen()]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [currentFen, setCurrentFen] = useState(chessRef.current.fen());
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  // Opening lesson state
  const [openingsPanelOpen, setOpeningsPanelOpen] = useState(true);
  const [activeOpening, setActiveOpening] = useState<Opening | null>(null);
  const [openingStep, setOpeningStep] = useState(-1);
  const [openingFen, setOpeningFen] = useState<string | null>(null);

  // Beta access key
  useEffect(() => {
    if (!localStorage.getItem("betaKey")) {
      const key = window.prompt("Enter beta access code:");
      if (key) localStorage.setItem("betaKey", key);
    }
  }, []);

  const {
    bestMove,
    evalScore,
    mateIn,
    topLines,
    analyzePosition,
    thinking: stockfishThinking,
  } = useStockfish();

  const fenToAnalyse = activeTab === "openings" && openingFen ? openingFen : currentFen;

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
    return [from as Square, to as Square, "rgba(56, 200, 122, 0.7)"];
  }, [bestMove]);

  const loadFenAt = useCallback(
    (index: number) => {
      const bounded = Math.min(Math.max(index, 0), history.length - 1);
      const fen = history[bounded];
      chessRef.current.load(fen);
      setHistoryIndex(bounded);
      setCurrentFen(fen);
      setLastMove(null);
    },
    [history]
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

  const handleQuestion = async (question: string) => {
    setThinking(true);
    setChatMessages((msgs) => [...msgs, { sender: "You", text: question }]);

    const contextFen = activeTab === "openings" && openingFen ? openingFen : currentFen;

    const openingContext =
      activeOpening && activeTab === "openings"
        ? `We are studying the ${activeOpening.name} (ECO ${activeOpening.eco}). `
        : "";
    const enrichedQuestion = openingContext ? openingContext + question : question;

    try {
      const conversationHistory = chatMessages
        .filter((_, i) => i > 0)
        .slice(-6)
        .map((msg) => ({
          role: msg.sender === "You" ? "You" : "assistant",
          content: msg.text,
        }));

      const moveHistory = chessRef.current.history();

      const response = await askGM({
        selectedGM,
        currentFen: contextFen,
        question: enrichedQuestion,
        conversationHistory,
        moveHistory,
        topLines,
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
    setChatMessages([
      {
        sender: "GM",
        text: `Let's study the ${opening.name}. Step through the moves and ask me anything.`,
      },
    ]);
  }, []);

  const handleExitOpeningLesson = useCallback(() => {
    setActiveOpening(null);
    setOpeningStep(-1);
    setOpeningFen(null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); handleBack(); }
      if (e.key === "ArrowRight") { e.preventDefault(); handleForward(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleBack, handleForward]);

  const displayFen = activeTab === "openings" && openingFen ? openingFen : currentFen;

  return (
    <div
      className="min-h-screen md:h-screen flex flex-col overflow-x-hidden md:overflow-hidden"
      style={{ background: "var(--c-bg)", color: "var(--c-text)", fontFamily: "var(--f-sans)" }}
    >
      {/* ════ Header ════ */}
      <header
        className="shrink-0"
        style={{ background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)" }}
      >
        {/* ── Main row: Logo + Tabs (+ GM pills on desktop) ── */}
        <div className="flex items-center justify-between px-4 py-2.5">
          {/* Brand */}
          <h1
            className="text-xl tracking-tight select-none"
            style={{
              fontFamily: "var(--f-serif)",
              fontWeight: 600,
              color: "var(--c-gold-bright)",
              letterSpacing: "-0.01em",
            }}
          >
            Ask <em style={{ fontStyle: "italic", color: "var(--c-text)" }}>GM</em>
          </h1>

          <div className="flex items-center gap-2">
            {/* Tab switcher */}
            <div
              className="flex items-center rounded-lg p-0.5 gap-0.5"
              style={{ background: "var(--c-raised)", border: "1px solid var(--c-border-mid)" }}
            >
              {(["game", "openings"] as AppTab[]).map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="px-3 py-1.5 rounded-md font-medium transition-all duration-150 text-xs md:text-sm"
                    style={{
                      background: isActive ? "var(--c-hover)" : "transparent",
                      border: `1px solid ${isActive ? "var(--c-border-bright)" : "transparent"}`,
                      color: isActive ? "var(--c-text)" : "var(--c-text-muted)",
                      fontFamily: "var(--f-sans)",
                    }}
                  >
                    {tab === "game" ? "♟ Game" : "📖 Openings"}
                  </button>
                );
              })}
            </div>

            {/* GM pills — desktop only (mobile has its own row below) */}
            <div className="hidden md:flex">
              <PersonalitySelector selected={selectedGM} onSelect={setSelectedGM} />
            </div>
          </div>
        </div>

        {/* ── Mobile GM selector row ── */}
        <div
          className="md:hidden grid grid-cols-3 gap-2 px-3 pb-3"
        >
          {(["Magnus", "Hikaru", "Bobby"] as const).map((name) => {
            const color =
              name === "Magnus" ? "var(--c-gm-magnus)"
              : name === "Hikaru" ? "var(--c-gm-hikaru)"
              : "var(--c-gm-bobby)";
            const isActive = selectedGM === name;
            return (
              <button
                key={name}
                onClick={() => setSelectedGM(name)}
                className="py-2 rounded-lg text-sm font-medium transition-all duration-150 text-center relative"
                style={{
                  background: isActive ? `${color}18` : "var(--c-raised)",
                  border: `1px solid ${isActive ? color : "var(--c-border-mid)"}`,
                  color: isActive ? color : "var(--c-text-muted)",
                  fontFamily: "var(--f-sans)",
                }}
              >
                {name}
                {isActive && (
                  <span
                    className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ background: color }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* ════ Main content ════ */}
      <main className="flex-1 flex flex-col md:flex-row gap-3 p-3 overflow-y-auto md:overflow-hidden md:min-h-0">

        {/* ── Left: Chess board panel — shrinks to board width, doesn't stretch ── */}
        <div className="flex flex-col md:overflow-y-auto md:shrink-0 min-w-0">
          <div className="w-full max-w-[600px]">
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
              topLines={topLines}
            />
          </div>
        </div>

        {/* ── Right: Openings panel + Chat — grows to fill remaining space ── */}
        <div
          className={`flex gap-3 md:flex-1 md:min-w-0 ${
            activeTab === "openings"
              ? "flex-col md:flex-row w-full md:h-full md:min-h-0"
              : "flex-col w-full md:h-full md:min-h-0 min-h-[300px]"
          }`}
        >
          {/* Openings panel */}
          {activeTab === "openings" && (
            <div
              className={`panel overflow-hidden flex flex-col md:flex-[3] md:min-w-0 md:h-full md:min-h-0 ${openingsPanelOpen ? "min-h-[300px]" : ""}`}
            >
              {/* Mobile accordion toggle */}
              <button
                className="md:hidden flex items-center justify-between px-4 py-3 w-full text-left"
                style={{ borderBottom: "1px solid var(--c-border)" }}
                onClick={() => setOpeningsPanelOpen((v) => !v)}
              >
                <span className="font-semibold text-sm" style={{ color: "var(--c-text)" }}>
                  {activeOpening ? activeOpening.name : "Opening Lessons"}
                </span>
                <span className="text-xs" style={{ color: "var(--c-text-muted)" }}>
                  {openingsPanelOpen ? "▲" : "▼"}
                </span>
              </button>
              <div className={`flex-1 min-h-0 p-4 overflow-hidden flex flex-col ${openingsPanelOpen ? "" : "hidden md:flex"}`}>
                <OpeningsPanel
                  onPositionChange={handleOpeningPositionChange}
                  onExit={handleExitOpeningLesson}
                  currentStep={openingStep}
                  onStepChange={setOpeningStep}
                  activeOpening={activeOpening}
                  onSelectOpening={handleSelectOpening}
                />
              </div>
            </div>
          )}

          {/* Chat window */}
          <div
            className={
              activeTab === "openings"
                ? "min-h-[350px] md:min-h-0 md:flex-[7] md:min-w-0 md:h-full"
                : "flex-1 min-h-0"
            }
          >
            <ChatWindow
              messages={chatMessages}
              onSubmit={handleQuestion}
              thinking={thinking}
              selectedGM={selectedGM}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
