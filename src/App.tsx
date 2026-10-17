import { useEffect, useMemo, useRef, useState } from "react";
import type { Arrow, Square } from "react-chessboard/dist/chessboard/types";
import BetaKeyModal from "./components/BetaKeyModal";
import BoardPanel from "./components/BoardPanel";
import BottomNav, { type MobileDestination } from "./components/BottomNav";
import ChatWindow from "./components/ChatWindow";
import EnginePanel from "./components/EnginePanel";
import FeedbackStrip, { type Feedback } from "./components/FeedbackStrip";
import GMSelector from "./components/GMSelector";
import Header, { type AppMode } from "./components/Header";
import LoadGameDialog from "./components/LoadGameDialog";
import MoveNotation from "./components/MoveNotation";
import OpeningsPanel from "./components/OpeningsPanel";
import ResultCard from "./components/ResultCard";
import Toast from "./components/Toast";
import { Copy, Play, Plus, Stop, Upload } from "./components/icons";
import type { Opening } from "./data/openings";
import { GMS, type GMName } from "./data/gms";
import type { EngineLine } from "./engine/uci";
import { useBetaGate } from "./hooks/useBetaGate";
import { type SendContext, useChat } from "./hooks/useChat";
import { useChessGame } from "./hooks/useChessGame";
import { useLatest } from "./hooks/useLatest";
import { useLesson } from "./hooks/useLesson";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { useMoveReviews } from "./hooks/useMoveReviews";
import { usePvPreview } from "./hooks/usePvPreview";
import { useStockfish } from "./hooks/useStockfish";
import { useToast } from "./hooks/useToast";
import { BOARD } from "./lib/boardTheme";
import type { ResolvedMove } from "./lib/chessMoves";
import { exportPgn, importGame, startsFromInitialPosition } from "./lib/importGame";
import { DESKTOP_QUERY } from "./lib/layout";
import { kingInCheckSquare, START_FEN } from "./lib/lines";
import { preferredSan, verdictLabel } from "./lib/moveReview";
import { detectOpening } from "./lib/openingDetection";
import { gameOutcome } from "./lib/outcome";

const NO_LINES: EngineLine[] = [];

/** A move as it is written in a score: "12.Nf3" for White, "12...Nf6" for Black. */
const scoreLabel = (ply: number, san: string) => `${Math.ceil(ply / 2)}${ply % 2 === 1 ? "." : "..."}${san}`;

export default function App() {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const gate = useBetaGate();
  const game = useChessGame();
  const lesson = useLesson();
  const engine = useStockfish();
  const chat = useChat({ betaKey: gate.betaKey, onUnauthorized: gate.lock });
  const { toast, show: showToast, dismiss: dismissToast } = useToast();

  const [mode, setMode] = useState<AppMode>("play");
  const [phoneTab, setPhoneTab] = useState<"board" | "chat">("board");
  const [selectedGM, setSelectedGM] = useState<GMName>("Magnus");
  const [seen, setSeen] = useState<Record<GMName, number>>({ Magnus: 1, Hikaru: 1, Bobby: 1 });
  const [gameId, setGameId] = useState(1);
  const [loadOpen, setLoadOpen] = useState(false);

  const learning = mode === "learn";

  // ── The position on screen ─────────────────────────────────────────
  // It comes from the game, or from the open lesson. Everything below (engine, chat context,
  // highlights) is derived from this one place, so nothing can describe a different position.
  const view = learning
    ? { fen: lesson.fen, lastMove: lesson.lastMove, index: lesson.index, played: lesson.playedSan, canBack: lesson.canBack, canForward: lesson.canForward, back: lesson.back, forward: lesson.forward }
    : { fen: game.fen, lastMove: game.lastMove, index: game.index, played: game.playedSan, canBack: game.canBack, canForward: game.canForward, back: game.back, forward: game.forward };

  const outcome = useMemo(() => gameOutcome(view.fen), [view.fen]);
  // Lessons and positions pasted from a FEN do not start from the initial position, so a move list
  // written relative to them would mislead the model; it is only sent when it is a real game.
  const standardStart = learning || startsFromInitialPosition(game.snapshot);

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
    return [bestMove.slice(0, 2) as Square, bestMove.slice(2, 4) as Square, BOARD.engineArrow];
  }, [learning, previewing, bestMove]);

  // ── How the last move was judged ───────────────────────────────────
  const reviews = useMoveReviews(game.plies, engine.fen, engine.lines);
  const verdict = !learning && game.index > 0 ? (reviews[game.index - 1] ?? null) : null;
  const playedPly = game.plies[game.index];
  const beforePly = game.plies[game.index - 1];

  const takeBackAndPlay = (uci: string) => {
    game.takeBack();
    game.makeMove(uci.slice(0, 2), uci.slice(2, 4), uci[4]);
  };

  let feedback: Feedback;
  if (learning) {
    // On a laptop the note sits in the lesson column beside the board; on a phone it must stay right under it.
    feedback = isDesktop
      ? { kind: "hint", text: "" }
      : { kind: "note", text: lesson.annotation ?? (lesson.opening ? (lesson.index === 0 ? "Step through the moves to see coaching notes." : "No note for this move.") : "Pick an opening from the list to study it here.") };
  } else if (verdict && playedPly?.san && playedPly.uci && beforePly) {
    const better = preferredSan(beforePly.fen, verdict, playedPly.uci);
    feedback = {
      kind: "verdict",
      verdict,
      move: scoreLabel(game.index, playedPly.san),
      preferred: better ? scoreLabel(game.index, better) : null,
      onTryInstead: verdict.bestMove && better ? () => takeBackAndPlay(verdict.bestMove as string) : undefined,
    };
  } else if (game.index > 0 && analysing && !outcome) {
    feedback = { kind: "checking" };
  } else {
    feedback = { kind: "hint", text: game.index === 0 ? "Move a piece to begin, or load your own game from the menu." : "" };
  }

  // ── Opening name (play mode) ───────────────────────────────────────
  const detected = useMemo(() => (learning || !standardStart ? null : detectOpening(game.playedUci)), [learning, standardStart, game.playedUci]);

  // ── Chat ───────────────────────────────────────────────────────────
  const thread = chat.threads[selectedGM];
  const lessonOpening = learning ? lesson.opening : null;
  const openingLabel = lessonOpening
    ? `${lessonOpening.name} (ECO ${lessonOpening.eco})`
    : detected
      ? `${detected.name} (ECO ${detected.eco})`
      : undefined;
  const openingName = lessonOpening ? lessonOpening.name : detected ? detected.name.split(" — ")[0] : null;
  const scope = learning ? `lesson:${lessonOpening?.eco ?? "none"}:${lesson.variation}` : `game:${gameId}`;

  const buildContext = (): SendContext => ({
    fen: view.fen,
    ply: view.index,
    scope,
    moveHistory: standardStart ? view.played : [],
    topLines: lines,
    openingName: openingLabel,
    moveReview: learning || !standardStart ? null : verdict,
    contextPrefix: lessonOpening ? `We are studying the ${lessonOpening.name} (ECO ${lessonOpening.eco}). ` : undefined,
  });

  const ask = (question: string) => {
    void chat.send(selectedGM, question, buildContext());
    setPhoneTab("chat");
  };

  const askFromBoard = () => {
    if (outcome) return ask("How did this game end?");
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
    chat.addNote(selectedGM, `Studying the ${opening.name} (${opening.eco}).`, { fen: START_FEN, ply: 0, scope: `lesson:${opening.eco}:-1` });
  };

  const quickAsks = useMemo(() => {
    if (outcome) return ["How did this game end?", "What was the turning point?", "What should I work on?"];
    const asks: string[] = [];
    if (verdict && (verdict.quality === "inaccuracy" || verdict.quality === "mistake" || verdict.quality === "blunder") && playedPly?.san) {
      asks.push(`Why was ${scoreLabel(game.index, playedPly.san)} ${verdict.quality === "inaccuracy" ? "an" : "a"} ${verdictLabel(verdict.quality).toLowerCase()}?`);
    }
    if (openingName) asks.push(`Explain the ${openingName}`);
    asks.push("Best move?", "Explain the plan", "What did I do wrong?", "Why this engine move?");
    return asks.slice(0, 5);
  }, [outcome, verdict, playedPly?.san, game.index, openingName]);

  // A new reply while another section is showing → a dot on the Chat tab.
  const chatVisible = isDesktop || phoneTab === "chat";
  useEffect(() => {
    if (chatVisible) setSeen((s) => (s[selectedGM] === thread.length ? s : { ...s, [selectedGM]: thread.length }));
  }, [chatVisible, selectedGM, thread.length]);
  const chatUnread = thread.length > seen[selectedGM] && thread[thread.length - 1]?.role === "gm";

  // ── Game actions ───────────────────────────────────────────────────
  const startNewGame = () => {
    const previous = game.newGame();
    const previousId = gameId;
    setGameId((id) => id + 1);
    setMode("play");
    setPhoneTab("board");
    showToast({
      message: "New game started.",
      action:
        previous.plies.length > 1
          ? {
              label: "Undo",
              run: () => {
                game.load(previous);
                setGameId(previousId);
              },
            }
          : undefined,
    });
  };

  const loadGame = (text: string) => {
    const result = importGame(text);
    if (result.ok) {
      game.load(result.state);
      setGameId((id) => id + 1);
      setMode("play");
      setPhoneTab("board");
      setLoadOpen(false);
      showToast({ message: result.summary });
    }
    return result;
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast({ message: `${what} copied.` });
    } catch {
      showToast({ message: `Could not copy the ${what}. Your browser blocked it.` });
    }
  };

  const menuItems = [
    { label: "New game", icon: <Plus size={18} />, onSelect: startNewGame },
    { label: "Load a game…", icon: <Upload size={18} />, onSelect: () => setLoadOpen(true) },
    { label: "Copy game (PGN)", icon: <Copy size={18} />, onSelect: () => void copy(exportPgn(game.snapshot), "PGN"), disabled: game.plies.length < 2 },
    { label: "Copy position (FEN)", icon: <Copy size={18} />, onSelect: () => void copy(game.fen, "FEN") },
  ];

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

  // While a dialog is up, nothing behind it should be reachable by keyboard or screen reader.
  const shellRef = useRef<HTMLDivElement>(null);
  const phonePaneRef = useRef<HTMLDivElement>(null);
  const locked = gate.status === "locked";
  const modalOpen = locked || loadOpen;
  useEffect(() => {
    if (shellRef.current) shellRef.current.inert = modalOpen;
  }, [modalOpen]);

  // ── Pieces of UI shared by the desktop and phone layouts ───────────
  const lessonActive = learning && lessonOpening !== null;
  const lessonControls = lessonActive ? (
    <button
      type="button"
      className="btn btn-icon"
      onClick={lesson.togglePlay}
      aria-pressed={lesson.playing}
      aria-label={lesson.playing ? "Stop auto-play" : "Start auto-play"}
      title={lesson.playing ? "Stop auto-play" : "Play the line automatically"}
    >
      {lesson.playing ? <Stop size={16} /> : <Play size={16} />}
    </button>
  ) : null;

  const result =
    outcome && !learning ? (
      <ResultCard outcome={outcome} gmName={GMS[selectedGM].name} onNewGame={startNewGame} onAsk={askFromBoard} askDisabled={chat.pendingGM !== null} />
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
      outcome={outcome}
      canBack={view.canBack}
      canForward={view.canForward}
      onBack={view.back}
      onForward={view.forward}
      onUndo={learning ? undefined : game.takeBack}
      gmName={GMS[selectedGM].name}
      onAsk={askFromBoard}
      askDisabled={chat.pendingGM !== null}
      extraControls={lessonControls}
      result={!isDesktop ? result : undefined}
      feedback={<FeedbackStrip feedback={feedback} />}
    />
  );

  const notation = (
    <section className="side-section" aria-label="Moves">
      <div className="panel-head">
        <h2 className="type-label">Moves</h2>
      </div>
      <MoveNotation sanMoves={game.sanMoves} verdicts={reviews} index={game.index} onNavigate={game.navigate} />
    </section>
  );

  const enginePanel = (
    <EnginePanel
      fen={view.fen}
      lines={lines}
      thinking={analysing}
      status={engine.status}
      outcome={outcome}
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
      quickAsks={quickAsks}
      headerExtra={isDesktop ? undefined : <GMSelector selected={selectedGM} onSelect={setSelectedGM} fill />}
    />
  );

  const lessonPanel = <OpeningsPanel lesson={lesson} onSelect={selectOpening} showNote={isDesktop} />;

  const mobileDestination: MobileDestination = phoneTab === "chat" ? "chat" : learning ? "learn" : "board";
  const goTo = (destination: MobileDestination) => {
    if (destination === "chat") return setPhoneTab("chat");
    setMode(destination === "learn" ? "learn" : "play");
    setPhoneTab("board");
  };

  return (
    <>
      <div ref={shellRef} className="app-shell" data-gm={selectedGM}>
        <Header mode={mode} onModeChange={setMode} selectedGM={selectedGM} onSelectGM={setSelectedGM} opening={detected} menuItems={menuItems} />

        {isDesktop ? (
          <main className="workspace">
            <div className="board-col">{boardPanel}</div>
            <div className="side-col">
              {learning ? (
                <div className="learn-layout">
                  <div className="learn-col">{lessonPanel}</div>
                  <div className="chat-col">{chatWindow}</div>
                </div>
              ) : (
                <>
                  <div className="side-top short:hidden">
                    {result}
                    {notation}
                    {enginePanel}
                  </div>
                  <div className="chat-col">{chatWindow}</div>
                </>
              )}
            </div>
          </main>
        ) : (
          <>
            <main className="phone-main">
              {phoneTab === "chat" ? (
                <div className="phone-column phone-chat">{chatWindow}</div>
              ) : (
                <div ref={phonePaneRef} className="phone-scroll">
                  <div className="phone-column">
                    {boardPanel}
                    {learning ? <div className="phone-learn">{lessonPanel}</div> : <div className="phone-stack">{notation}{enginePanel}</div>}
                  </div>
                </div>
              )}
            </main>
            <BottomNav active={mobileDestination} onChange={goTo} chatUnread={chatUnread} />
          </>
        )}
      </div>

      {/* Outside the shell: the shell is inert while a dialog is open. */}
      {locked && <BetaKeyModal onUnlock={gate.unlock} />}
      {loadOpen && !locked && <LoadGameDialog onLoad={loadGame} onClose={() => setLoadOpen(false)} />}
      <Toast toast={toast} onDismiss={dismissToast} />
    </>
  );
}
