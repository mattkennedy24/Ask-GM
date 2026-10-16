# Ask GM

Chess coaching with AI grandmasters. Play a game on the board, watch Stockfish analyse it live in your browser, and ask **Magnus Carlsen**, **Hikaru Nakamura** or **Bobby Fischer** what they would play — in their own voice, grounded in the engine's actual lines.

![Ask GM on a laptop: board with engine arrow, Stockfish lines, and a chat with Magnus](docs/screenshots/desktop.jpg)

<p>
  <img src="docs/screenshots/phone-board.jpg" alt="Phone: board and engine lines" width="260" />
  <img src="docs/screenshots/phone-chat.jpg" alt="Phone: chat with a grandmaster" width="260" />
</p>

## Features

- **Live engine analysis, in the browser.** Stockfish 16 runs in a Web Worker: top three lines, an eval bar, a best-move arrow, and a preview mode to step through any engine line on the board.
- **Three grandmasters, three voices.** Each has their own persona, their own conversation thread, and a funny in-character brush-off for anything that isn't chess.
- **Answers grounded in the position.** The model is given the FEN, move history, material and king-safety facts, and the engine lines, and is told to recommend only moves from those lines. Replies are checked for impossible moves and corrected once if needed.
- **Click a suggested move to play it.** Moves in a reply are highlighted; the ones that are legal in the position the reply was written for are buttons.
- **Opening lessons.** 27 openings with variations, per-move coaching notes and auto-play. The current opening is also detected as you play.
- **Built for phones and laptops.** A two-column layout on laptops; on a phone the board gets the whole width and a bottom bar switches between Board, Chat and Learn. Respects iPhone safe areas, 16px inputs (no iOS zoom), and reduced motion.
- **Private beta access code**, verified by the server.

## Quick start

Requires **Node.js 20.19+** and an [Anthropic API key](https://console.anthropic.com/).

```bash
npm install
cp .env.example .env        # then set ANTHROPIC_API_KEY
npm run dev                 # app on http://localhost:5173, API on :3001
```

Without `BETA_PASSCODE` the access-code gate is off, which is what you want locally.

## Configuration

Set these in `.env` locally, or as service variables on your host. Never commit a real `.env`.

| Variable | Required | Description |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | yes | Server-side key used for `/api/chat`. Without it chat answers `503`. |
| `BETA_PASSCODE` | no | Access code for the private beta. **If unset, the gate is disabled and the API is open to anyone with the URL** (the server logs a warning in production). Surrounding whitespace/quotes are ignored. |
| `PORT` | no | Defaults to `3001`. Most hosts set this for you. |
| `ANTHROPIC_MODEL` | no | Defaults to `claude-sonnet-4-6`. |
| `TRUST_PROXY` | no | Reverse proxies in front of the app, for correct per-client rate limiting. Defaults to `1` in production (Railway, Heroku, Render…) and off in development. |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server + Express API together |
| `npm run build` | Type-check, then production build into `dist/` |
| `npm start` | Serve the API **and** the built app on one port (`NODE_ENV=production`) |
| `npm test` | Unit and integration tests (Vitest) |
| `npm run lint` | ESLint for the frontend and the server |
| `npm run typecheck` | `tsc -b` |
| `npm run check` | lint + typecheck + tests — run before committing |

## How it works

```
 Browser                                              Server (Express)                    Anthropic
┌──────────────────────────────┐                     ┌───────────────────────────┐        ┌────────┐
│ React UI                     │  POST /api/chat     │ beta gate → rate limit    │        │ Claude │
│  game · lesson · chat state  │ ──────────────────► │ sanitise + validate input │ ─────► │        │
│                              │  question, FEN,     │ off-topic guard           │        │        │
│ Stockfish 16 (Web Worker)    │  moves, engine      │ build prompt (persona +   │ ◄───── │        │
│  top-3 lines, White-POV eval │  lines              │  position facts + lines)  │        └────────┘
│                              │ ◄────────────────── │ check moves, retry once   │
└──────────────────────────────┘  reply + follow-ups │ strip markdown, split chips│
                                                     └───────────────────────────┘
```

- **The engine runs client-side**, so analysis is free and instant. The single-threaded Stockfish build is used because it needs no special headers or 40 MB network file (≈ 600 KB total, copied from the `stockfish` package into `/engine/` by a small Vite plugin). Scores are normalised to White's point of view. If a Worker can't start, it falls back to the Lichess cloud-eval cache.
- **Every request field is validated on the server** before it reaches the prompt: the FEN must be a legal position, the opening name is reduced to a plain line, moves must look like SAN/UCI, history roles are whitelisted and reshaped so the Anthropic API accepts them, and sizes are capped. Control and invisible characters are stripped.
- **Blatant off-topic requests** (code, "ignore your instructions") get an in-character reply without spending a model call; subtler ones are handled by the persona prompts.
- **Move checking** compares moves named in a reply with the legal moves in the position, the moves along the engine lines, and moves already played. Only a move playable nowhere triggers one corrective retry.

## Beta access code

The beta gate is enforced by the server, not just the UI:

1. On load the browser asks `GET /api/auth/status` whether a code is needed. If not, no prompt is shown.
2. The prompt verifies the code with `POST /api/auth/verify` (constant-time comparison, failed attempts rate-limited). A wrong code is rejected and **not** stored.
3. A stored code is re-verified on load, and any `401` from `/api/chat` (code rotated or revoked) puts the prompt back up and keeps the question so you can retry.

To rotate the code, change `BETA_PASSCODE` and redeploy.

## Deploying (Railway)

- **Build command:** `npm run build`
- **Start command:** `npm start`
- **Variables:** `ANTHROPIC_API_KEY`, `BETA_PASSCODE` (see above). `PORT` is provided by the platform.
- **Health check:** `GET /api/health` (public, returns `{"status":"ok"}`).

The server serves `dist/` itself, caches fingerprinted assets for a year, gzips responses, and answers SPA routes with `index.html` (a missing `/assets/*.js` is a real 404, not HTML).

## Project layout

```
server/
  index.js, app.js, config.js     entrypoint · Express app factory · environment config
  gmPersonalities.js              the three persona prompts
  lib/                            betaAuth, sanitize, prompt, coach (pipeline), moveValidation,
                                  followUps, plainText, offTopic, classify, chessContext
  __tests__/                      unit + HTTP integration tests (fake Anthropic client)
src/
  App.tsx                         composition and layout
  components/                     UI (board, engine panel, chat, lessons, modal, nav…)
  hooks/                          useChessGame, useLesson, useStockfish, useChat, useBetaGate…
  engine/                         UCI parsing, the analyzer state machine, Lichess fallback
  lib/                            pure logic: game state, move text, evaluation, material, opening detection
  data/                           opening lessons, grandmaster profiles
```

## Testing

`npm test` runs 300+ tests: the server pipeline over real HTTP with a fake model client (beta gate, validation, error mapping, rate limits, static serving), the engine analyzer against a scripted fake engine (including the stale-`bestmove` race), the move-text/tokenizer logic, and an **opening-data integrity test** that replays every lesson line with chess.js.

## Security notes

Implemented: server-verified access code, constant-time comparison, rate limiting (chat, and failed code attempts), strict input validation and sanitisation, prompt-injection resistance, JSON error handling, `trust proxy` for correct client IPs. Deliberately deferred and tracked: [CORS restriction (#17)](https://github.com/mattkennedy24/Ask-GM/issues/17) and [security headers / CSP (#18)](https://github.com/mattkennedy24/Ask-GM/issues/18).

## Third-party software

- [Stockfish.js](https://github.com/nmrugg/stockfish.js) 16 (WebAssembly build of [Stockfish](https://stockfishchess.org/)) — **GPL-3.0**. It is served to users with the app.
- [chess.js](https://github.com/jhlywa/chess.js), [react-chessboard](https://github.com/Clariity/react-chessboard), React, Vite, Tailwind CSS, Express, and the [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript).
- Grandmaster personas are stylised portrayals for coaching and entertainment; they are not the people, and nothing here is endorsed by them.
