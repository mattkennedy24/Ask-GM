# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository. See `README.md` for the user-facing overview.

## What this app is

**Ask GM** is a chess coaching app. Users play on a board, Stockfish analyses it in the browser, and they ask AI grandmaster personas (Magnus Carlsen, Hikaru Nakamura, Bobby Fischer, powered by Claude) about the position. There is also an opening-lesson mode and a private-beta access code.

## Commands

```bash
npm run dev         # Vite (5173) + Express API (3001) together
npm run build       # tsc -b && vite build  ← this is exactly what the Railway build runs
npm start           # production server: API + built frontend on one port
npm test            # vitest run (server + client logic)
npm run lint        # eslint — covers src/, server/, e2e/ and scripts/
npm run typecheck   # tsc -b
npm run check       # lint + typecheck + tests
npm run e2e         # Playwright: the real app in a real browser, on a laptop and an iPhone-sized screen
npm run verify:openings   # Stockfish check of every opening lesson (about a minute)
npm run verify:tactics    # the coach's computed capture facts vs a brute-force search (a few minutes)
```

Run `npm run check` and `npm run build` before committing; run `npm run e2e` after changing anything a person can see or touch. **`npm run build` includes `tsc -b` under strict settings**: type errors fail the deploy even when `vite build` alone would pass. The tsconfig uses `erasableSyntaxOnly`, so no constructor parameter properties, enums or namespaces.

Needs `ANTHROPIC_API_KEY` in `.env` for real chat (`cp .env.example .env`). Tests never need it: they use a fake Anthropic client.

## Architecture

**Server** (`server/`, plain ES modules)
- `index.js` – entrypoint only: loads env, builds the Anthropic client, listens, handles SIGTERM.
- `app.js` – `createApp({ config, anthropic, personalities, distDir })`: routes, middleware, static files, error handling. Everything is injected so tests run the real routing without a network.
- `config.js` – environment → config (`normalizeSecret`, `parseTrustProxy`).
- `lib/` – `betaAuth` (constant-time passcode check), `sanitize` (validates *every* request field), `prompt`, `chessContext` (phase-aware king safety, game result), `tactics` (computed facts: static-exchange "what can be won", pawn structure, bishops, checks/captures), `moveReview` (turns the browser's verdicts into sentences, after replaying the move list itself), `coach` (the per-question pipeline), `moveValidation`, `followUps`, `plainText` (also strips emoji), `offTopic`, `classify`.
- Routes: `GET /api/health`, `GET /api/auth/status`, `POST /api/auth/verify`, `POST /api/chat`; unknown `/api/*` is a JSON 404.

**Frontend** (`src/`, React 18 + TypeScript + Tailwind v4 via `@tailwindcss/vite`)
- `App.tsx` composes the hooks and picks the layout. One value, `view`, is "the position on screen" (the game or the open lesson); the engine, chat context and highlights all derive from it.
- `hooks/` – `useChessGame`, `useLesson`, `useStockfish`, `usePvPreview`, `useChat` (one thread per grandmaster, scoped per game or lesson), `useBetaGate`, `useMediaQuery`, `useLatest`, `useToast`; and the move-judging trio `useEvalBook` (the deepest evaluation seen per position), `useGameReview` (a second, quiet Stockfish for the positions you are not looking at) and `useMoveReviews` (a verdict per move).
- `engine/` – `uci.ts` (parsing), `analyzer.ts` (the single-search state machine), `reviewQueue.ts` (what the quiet engine looks at next), `worker.ts`, `lichess.ts` (fallback).
- `lib/` – pure, tested logic: game state, PGN/FEN import (`importGame`), SAN tokenising, evaluation labels, material, opening detection, game outcome, `moveReview` (win-chance verdicts: best/good/inaccuracy/mistake/blunder) and `reviewSummary`.
- `components/` – one file per piece of the interface; `styles/` – the design system (see below).
- `data/openings.ts` – lesson data in UCI, **engine-verified**; `data/gms.ts` – grandmaster profiles; `data/pieceArt.ts` – piece artwork for the captured-piece figurines.

## Things that are easy to get wrong

- **Engine scores are White's point of view everywhere.** UCI reports relative to the side to move; `engine/uci.ts#toWhitePerspective` converts. The eval bar, labels and the model's prompt all assume White-POV.
- **Stockfish runs from `/engine/stockfish-16-single.{js,wasm}`**, copied out of `node_modules/stockfish` by the plugin in `vite.config.ts` (served in dev, emitted in build). Don't `import("stockfish")` — it can't resolve in a browser — and don't switch to the multi-threaded build (needs COOP/COEP headers).
- **Design system.** Read `docs/design-system.md`. In short: paper and ink, two typefaces, seven named type roles (`type-display` … `type-label`) and no other sizes, colours only from tokens (yellow = where we are, blue = the engine, red = danger), flat (no shadows, blurs, gradients, emoji). `src/styles/design-system.test.ts` fails the build on a violation, so a new size, colour or inline style has to be a deliberate change to the system, not a shortcut. Components carry layout in Tailwind utilities and appearance in classes from `src/styles/`; inline `style` is only for a runtime CSS custom property.
- **Never build a colour like `` `${"var(--color-x)"}22` ``**: `var(--color-x)22` is invalid CSS and silently drops the declaration. Use `color-mix(in srgb, var(--gm) 14%, transparent)`. The active grandmaster's ink is `--gm` (set via `data-gm` on `.app-shell`).
- **Layout switching**: `desk:` / `handheld:` / `short:` Tailwind variants in `index.css` mirror `DESKTOP_QUERY` in `src/lib/layout.ts`; inside `src/styles/*.css` write the laptop query out in full as a raw `@media`, because Tailwind's `@variant desk` keeps only the first condition of a query list when nested in a rule. A test keeps all copies identical.
- **Move verdicts need two evaluations**: the position before the move and the one after, both at depth 12 or more (`MIN_REVIEW_DEPTH`). The main engine only looks at the position on screen, so `useGameReview` searches the others quietly. Never show a verdict, or send one to the coach, from a shallower search. The server never trusts the browser's words: it takes a fixed vocabulary, a bounded number and a UCI move, replays the move list itself, and writes the sentence (`server/lib/moveReview.js`).
- **Positions pasted from a FEN do not start from the initial position**: no move list is sent to the coach, no opening is named, and no captured pieces are drawn (`startsFromInitialPosition`).
- **Chat history is scoped** (`ChatMessage.scope`: `game:N` or `lesson:ECO:variation`) so a new game or a lesson never inherits answers about another position.
- **react-chessboard** wipes drawn arrows whenever the `customArrows` prop changes identity, and `onArrowsChange` only reports user arrows. Never feed user arrows back into `customArrows`.
- **Opening data** must replay legally from the start position (`src/data/openings.test.ts`) **and be sound chess** (`npm run verify:openings` runs Stockfish over every line and fails on a move that gives up more than 1.2 pawns, or a line that ends clearly better for one side). Edit lines in SAN, convert to UCI, and keep `annotations[i]` describing ply `i+1`.
- **Prompt input is untrusted.** Anything new that reaches the model must go through `server/lib/sanitize.js`. The FEN, opening name, move list, engine lines and chat history all end up in the system prompt.
- **A `401` from `/api/chat` means "bad beta code"** to the client (it re-locks the gate). The server therefore maps upstream Anthropic auth failures to `502`, never `401`.
- **Secrets**: `ANTHROPIC_API_KEY` and `BETA_PASSCODE` live in environment variables only (Railway in production); `.env` is gitignored.

## Product decisions (don't undo without asking)

- Grandmasters answer in plain conversational prose, no markdown and no emoji (the prompt says so and `plainText.js` enforces it); the chat should read like texting a person.
- The visual direction is a newspaper games page (paper, ink, one serif, one sans, thin rules). Do not reintroduce a dark theme, gold/amber accents, glows, shadows or emoji.
- Anything unrelated to chess gets a short, funny, in-character dismissal.
- Target devices: recent iPhones (iPhone 16 Pro, 393px) and laptops.
- Deferred on purpose and tracked as issues: restricting CORS (#17) and Helmet/CSP (#18). Don't add them as part of unrelated work.
