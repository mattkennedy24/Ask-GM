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
npm run lint        # eslint — covers src/ AND server/
npm run typecheck   # tsc -b
npm run check       # lint + typecheck + tests
```

Run `npm run check` and `npm run build` before committing. **`npm run build` includes `tsc -b` under strict settings**: type errors fail the deploy even when `vite build` alone would pass. The tsconfig uses `erasableSyntaxOnly`, so no constructor parameter properties, enums or namespaces.

Needs `ANTHROPIC_API_KEY` in `.env` for real chat (`cp .env.example .env`). Tests never need it: they use a fake Anthropic client.

## Architecture

**Server** (`server/`, plain ES modules)
- `index.js` – entrypoint only: loads env, builds the Anthropic client, listens, handles SIGTERM.
- `app.js` – `createApp({ config, anthropic, personalities, distDir })`: routes, middleware, static files, error handling. Everything is injected so tests run the real routing without a network.
- `config.js` – environment → config (`normalizeSecret`, `parseTrustProxy`).
- `lib/` – `betaAuth` (constant-time passcode check), `sanitize` (validates *every* request field), `prompt`, `chessContext`, `coach` (the per-question pipeline), `moveValidation`, `followUps`, `plainText`, `offTopic`, `classify`.
- Routes: `GET /api/health`, `GET /api/auth/status`, `POST /api/auth/verify`, `POST /api/chat`; unknown `/api/*` is a JSON 404.

**Frontend** (`src/`, React 18 + TypeScript + Tailwind v4 via `@tailwindcss/vite`)
- `App.tsx` composes the hooks and picks the layout. One value, `view`, is "the position on screen" (the game or the open lesson); the engine, chat context and highlights all derive from it.
- `hooks/` – `useChessGame`, `useLesson`, `useStockfish`, `usePvPreview`, `useChat` (one thread per grandmaster), `useBetaGate`, `useMediaQuery`, `useLatest`.
- `engine/` – `uci.ts` (parsing), `analyzer.ts` (the single-search state machine), `lichess.ts` (fallback).
- `lib/` – pure, tested logic (game state, SAN tokenising, evaluation labels, material, opening detection).
- `data/openings.ts` – lesson data in UCI; `data/gms.ts` – grandmaster profiles.

## Things that are easy to get wrong

- **Engine scores are White's point of view everywhere.** UCI reports relative to the side to move; `engine/uci.ts#toWhitePerspective` converts. The eval bar, labels and the model's prompt all assume White-POV.
- **Stockfish runs from `/engine/stockfish-16-single.{js,wasm}`**, copied out of `node_modules/stockfish` by the plugin in `vite.config.ts` (served in dev, emitted in build). Don't `import("stockfish")` — it can't resolve in a browser — and don't switch to the multi-threaded build (needs COOP/COEP headers).
- **Never build a colour like `` `${"var(--c-x)"}22` ``**: `var(--c-x)22` is invalid CSS and silently drops the declaration. Use `color-mix(in srgb, var(--gm) 14%, transparent)`. The active grandmaster's accent is `--gm` (set via `data-gm` on `.app-shell`); use `--gm-text` for text on a tint of it.
- **Layout switching**: `desk:` / `handheld:` / `short:` Tailwind variants in `index.css` mirror `DESKTOP_QUERY` in `src/lib/layout.ts`. Keep them in step. Prefer CSS classes over `onMouseEnter` style mutation.
- **react-chessboard** wipes drawn arrows whenever the `customArrows` prop changes identity, and `onArrowsChange` only reports user arrows. Never feed user arrows back into `customArrows`.
- **Opening data** must replay legally from the start position; `src/data/openings.test.ts` enforces it. Edit lines in SAN, convert to UCI, and keep `annotations[i]` describing ply `i+1`.
- **Prompt input is untrusted.** Anything new that reaches the model must go through `server/lib/sanitize.js`. The FEN, opening name, move list, engine lines and chat history all end up in the system prompt.
- **A `401` from `/api/chat` means "bad beta code"** to the client (it re-locks the gate). The server therefore maps upstream Anthropic auth failures to `502`, never `401`.
- **Secrets**: `ANTHROPIC_API_KEY` and `BETA_PASSCODE` live in environment variables only (Railway in production); `.env` is gitignored.

## Product decisions (don't undo without asking)

- Grandmasters answer in plain conversational prose, no markdown (the prompt says so and `plainText.js` enforces it); the chat should read like texting a person.
- Anything unrelated to chess gets a short, funny, in-character dismissal.
- Target devices: recent iPhones (iPhone 16 Pro, 393px) and laptops.
- Deferred on purpose and tracked as issues: restricting CORS (#17) and Helmet/CSP (#18). Don't add them as part of unrelated work.
