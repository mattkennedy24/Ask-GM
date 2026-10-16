import { useEffect, useMemo, useRef, useState } from "react";
import type { Arrow, Square } from "react-chessboard/dist/chessboard/types";
import BetaKeyModal from "./components/BetaKeyModal";
import BoardPanel from "./components/BoardPanel";
import BottomNav, { type MobileDestination } from "./components/BottomNav";
import ChatWindow from "./components/ChatWindow";
import EnginePanel from "./components/EnginePanel";
import GMSelector from "./components/GMSelector";
import Header, { type AppMode } from "./components/Header";
import MoveNotation from "./components/MoveNotation";
import OpeningsPanel from "./components/OpeningsPanel";
import { Play, Stop } from "./components/icons";
import type { Opening } from "./data/openings";
import { GMS, type GMName } from "./data/gms";
import type { EngineLine } from "./engine/uci";
import { useBetaGate } from "./hooks/useBetaGate";
import { type SendContext, useChat } from "./hooks/useChat";
import { useChessGame } from "./hooks/useChessGame";
import { useLatest } from "./hooks/useLatest";
import { useLesson } from "./hooks/useLesson";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { usePvPreview } from "./hooks/usePvPreview";
import { useStockfish } from "./hooks/useStockfish";
import type { ResolvedMove } from "./lib/chessMoves";
import { kingInCheckSquare, START_FEN } from "./lib/lines";
import { DESKTOP_QUERY } from "./lib/layout";
import { detectOpening } from "./lib/openingDetection";

const NO_LINES: EngineLine[] = [];
const ENGINE_ARROW_COLOR = "rgba(63, 200, 122, 0.7)";

export default function App() {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const gate = useBetaGate();
  const game = useChessGame();
  const lesson = useLesson();
  const engine = useStockfish();
  const chat = useChat({ betaKey: gate.betaKey, onUnauthorized: gate.lock });

  const [mode, setMode] = useState<AppMode>("play");
  const [phoneTab, setPhoneTab] = useState<"board" | "chat">("board");
  const [selectedGM, setSelectedGM] = useState<GMName>("Magnus");
  const [seen, setSeen] = useState<Record<GMName, number>>({ Magnus: 1, Hikaru: 1, Bobby: 1 });

  const learning = mode === "learn";

  // ── The position on screen ─────────────────────────────────────────
  // It comes from the game, or from the open lesson. Everything below (engine, chat context,
  // highlights) is derived from this one place, so nothing can describe a different position.
  const view = learning
    ? { fen: lesson.fen, lastMove: lesson.lastMove, index: lesson.index, played: lesson.playedSan, canBack: lesson.canBack, canForward: lesson.canForward, back: lesson.back, forward: lesson.forward }
    : { fen: game.fen, lastMove: game.lastMove, index: game.index, played: game.playedSan, canBack: game.canBack, canForward: game.canForward, back: game.back, forward: game.forward };

  // ── Engine ─────────────────────────────────────────────────────────
  const { analyze } = engine;
  useEffect(() => {
    analyze(view.fen);
  }, [view.fen, analyze]);

  const lines = engine.fen === view.fen ? engine.lines : NO_LINES;
  const analysing = engine.fen !== view.fen || engine.thinking;
  const top = lines[0];

  const pv = usePvPreview(view.fen, lines);
  const previewing = pv.preview !== null;
  const shownFen = pv.preview?.fen ?? view.fen;
  const shownLastMove = pv.preview ? pv.preview.lastMove : view.lastMove;
  const checkSquare = useMemo(() => kingInCheckSquare(shownFen), [shownFen]);

  const bestMove = top?.pv[0];
  const engineArrow = useMemo<Arrow | null>(() => {
    // The engine's favourite isn't shown on lesson boards: it would contradict the lesson's own move.
    if (learning || previewing || !bestMove || bestMove.length < 4) return null;
    return [bestMove.slice(0, 2) as Square, bestMove.slice(2, 4) as Square, ENGINE_ARROW_COLOR];
  }, [learning, previewing, bestMove]);

  // ── Opening name (play mode) ───────────────────────────────────────
  const detected = useMemo(() => (learning ? null : detectOpening(game.playedUci)), [learning, game.playedUci]);

  // ── Chat ───────────────────────────────────────────────────────────
  const thread = chat.threads[selectedGM];
  const lessonOpening = learning ? lesson.opening : null;
  const openingLabel = lessonOpening
    ? `${lessonOpening.name} (ECO ${lessonOpening.eco})`
    : detected
      ? `${detected.name} (ECO ${detected.eco})`
      : undefined;

  const buildContext = (): SendContext => ({
    fen: view.fen,
    ply: view.index,
    moveHistory: view.played,
    topLines: lines,
    openingName: openingLabel,
    contextPrefix: lessonOpening ? `We are studying the ${lessonOpening.name} (ECO ${lessonOpening.eco}). ` : undefined,
  });

  const ask = (question: string) => {
    void chat.send(selectedGM, question, buildContext());
    setPhoneTab("chat");
  };

  const askFromBoard = () => {
    if (!learning) return ask("What should I play here?");
    if (!lessonOpening) return ask("What are the key principles of the opening?");
    return ask(lesson.index === 0 ? `What is the idea behind the ${lessonOpening.name}?` : "What's the idea behind this move?");
  };

  const playSuggestedMove = (move: ResolvedMove) => {
    if (game.makeMove(move.from, move.to, move.promotion)) setPhoneTab("board");
  };

  const selectOpening = (opening: Opening) => {
    lesson.select(opening);
    // On a phone the list sits below the board; bring the board (and the stepping controls under it) back into view.
    phonePaneRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    chat.addNote(selectedGM, `Studying the ${opening.name} (${opening.eco}).`, { fen: START_FEN, ply: 0 });
  };

  // A new reply while another section is showing → a dot on the Chat tab.
  const chatVisible = isDesktop || phoneTab === "chat";
  useEffect(() => {
    if (chatVisible) setSeen((s) => (s[selectedGM] === thread.length ? s : { ...s, [selectedGM]: thread.length }));
  }, [chatVisible, selectedGM, thread.length]);
  const chatUnread = thread.length > seen[selectedGM] && thread[thread.length - 1]?.role === "gm";

  // ── Keyboard: ← → move through the game, lesson or engine line; Esc leaves an engine line ──
  const keyHandler = useLatest((event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      if (pv.selectedLine >= 0) pv.stepBy(direction);
      else if (direction === -1) view.back();
      else view.forward();
    } else if (event.key === "Escape" && pv.selectedLine >= 0) {
      pv.exit();
    }
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => keyHandler.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [keyHandler]);

  // While the access-code dialog is up, nothing behind it should be reachable by keyboard or screen reader.
  const shellRef = useRef<HTMLDivElement>(null);
  const phonePaneRef = useRef<HTMLDivElement>(null);
  const locked = gate.status === "locked";
  useEffect(() => {
    if (shellRef.current) shellRef.current.inert = locked;
  }, [locked]);

  // ── Pieces of UI shared by the desktop and phone layouts ───────────
  // In a lesson the stepping controls and the coaching note live under the board, so they stay in view
  // beside it on a phone instead of scrolling away with the lesson panel.
  const lessonActive = learning && lessonOpening !== null;
  const lessonControls = lessonActive ? (
    <button
      type="button"
      className="btn btn-icon"
      onClick={lesson.togglePlay}
      aria-pressed={lesson.playing}
      aria-label={lesson.playing ? "Stop auto-play" : "Start auto-play"}
      title={lesson.playing ? "Stop auto-play" : "Play the line automatically"}
      style={lesson.playing ? undefined : { color: "var(--c-line1)", borderColor: "var(--c-line1-border)" }}
    >
      {lesson.playing ? <Stop size={15} /> : <Play size={15} />}
    </button>
  ) : null;
  const lessonNote = lessonActive ? (
    <p
      role="status"
      className="rounded-lg border px-3 py-2 text-xs leading-relaxed"
      style={{
        minHeight: "3.5rem",
        background: lesson.annotation ? "var(--c-raised)" : "transparent",
        borderColor: lesson.annotation ? "var(--c-border-bright)" : "var(--c-border)",
        color: lesson.annotation ? "var(--c-text-soft)" : "var(--c-text-muted)",
      }}
    >
      {lesson.annotation ?? (lesson.index === 0 ? "Step through the moves to see coaching notes." : "No note for this move.")}
    </p>
  ) : null;

  const boardPanel = (
    <BoardPanel
      fen={shownFen}
      interactive={!learning && !previewing}
      onMove={game.makeMove}
      lastMove={shownLastMove}
      kingInCheckSquare={checkSquare}
      engineArrow={engineArrow}
      score={top?.score ?? null}
      mate={top?.mate ?? null}
      thinking={analysing}
      hasAnalysis={lines.length > 0}
      canBack={view.canBack}
      canForward={view.canForward}
      onBack={view.back}
      onForward={view.forward}
      onUndo={learning ? undefined : game.takeBack}
      gmName={GMS[selectedGM].name}
      onAsk={askFromBoard}
      askDisabled={chat.pendingGM !== null}
      extraControls={lessonControls}
      footer={lessonNote}
    />
  );

  const notation = (
    <div className="panel px-3 py-2.5">
      <MoveNotation sanMoves={game.sanMoves} index={game.index} onNavigate={game.navigate} />
    </div>
  );

  const enginePanel = (
    <EnginePanel
      fen={view.fen}
      lines={lines}
      thinking={analysing}
      status={engine.status}
      selectedLine={pv.selectedLine}
      step={pv.step}
      length={pv.length}
      onSelect={pv.select}
      onStep={pv.stepBy}
      onExit={pv.exit}
    />
  );

  const chatWindow = (
    <ChatWindow
      gm={selectedGM}
      messages={thread}
      thinking={chat.pendingGM === selectedGM}
      busy={chat.pendingGM !== null}
      onSend={ask}
      onRetry={(id) => chat.retry(selectedGM, id, buildContext())}
      playableFen={learning ? null : game.fen}
      onPlayMove={playSuggestedMove}
      openingName={lessonOpening ? lessonOpening.name : detected ? detected.name.split(" — ")[0] : null}
      headerExtra={isDesktop ? undefined : <GMSelector selected={selectedGM} onSelect={setSelectedGM} fill />}
    />
  );

  const lessonPanel = <OpeningsPanel lesson={lesson} onSelect={selectOpening} />;

  const mobileDestination: MobileDestination = phoneTab === "chat" ? "chat" : learning ? "learn" : "board";
  const goTo = (destination: MobileDestination) => {
    if (destination === "chat") return setPhoneTab("chat");
    setMode(destination === "learn" ? "learn" : "play");
    setPhoneTab("board");
  };

  return (
    <>
      <div ref={shellRef} className="app-shell" data-gm={selectedGM}>
      <Header mode={mode} onModeChange={setMode} selectedGM={selectedGM} onSelectGM={setSelectedGM} opening={detected} />

      {isDesktop ? (
        <main className="flex min-h-0 flex-1 gap-3 p-3">
          <div className="board-col flex min-h-0 flex-col gap-3 self-start overflow-y-auto">{boardPanel}</div>
          {learning ? (
            <div className="flex min-h-0 min-w-0 flex-1 gap-3">
              <div className="panel min-h-0 min-w-0 flex-1 basis-0 overflow-hidden">{lessonPanel}</div>
              <div className="min-h-0 min-w-0 flex-1 basis-0">{chatWindow}</div>
            </div>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
              <div className="short:hidden">{notation}</div>
              <div className="short:hidden">{enginePanel}</div>
              <div className="min-h-0 flex-1">{chatWindow}</div>
            </div>
          )}
        </main>
      ) : (
        <>
          <main className="min-h-0 flex-1">
            {phoneTab === "chat" ? (
              <div className="mx-auto h-full max-w-[640px] p-2">{chatWindow}</div>
            ) : (
              <div ref={phonePaneRef} className="h-full overflow-y-auto overscroll-contain">
                <div className="mx-auto w-full max-w-[640px]">
                  {boardPanel}
                  {learning ? (
                    <div className="panel m-2">{lessonPanel}</div>
                  ) : (
                    <div className="flex flex-col gap-2 p-2">
                      {notation}
                      {enginePanel}
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
          <BottomNav active={mobileDestination} onChange={goTo} chatUnread={chatUnread} />
        </>
      )}
      </div>

      {/* Outside the shell: the shell is inert while this is open. */}
      {locked && <BetaKeyModal onUnlock={gate.unlock} />}
    </>
  );
}
