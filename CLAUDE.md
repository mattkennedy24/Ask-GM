# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Does

**Ask-GM** is an interactive chess app where users play chess and ask questions to AI-powered grandmaster personas (Magnus Carlsen, Hikaru Nakamura, Bobby Fischer) powered by Claude. The app combines Stockfish chess engine analysis with Claude's conversational AI to give in-character GM responses.

## Development Commands

```bash
npm run dev           # Run frontend + backend concurrently (recommended)
npm run dev:client    # Vite dev server only (port 5173)
npm run dev:server    # Express backend only (port 3001)
npm run build         # TypeScript compile + Vite production build
npm run lint          # ESLint
npm run preview       # Preview production build
```

**Required environment variable**: Copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`.

## Architecture

Two-process dev setup connected via Vite proxy (`/api` → `http://localhost:3001`):

**Frontend** (`src/`) — React + TypeScript + Tailwind (dark theme)
- `App.tsx` — Root component; owns all state: selected GM, chat history, board position/FEN, move history, Stockfish best move
- `features/ChessPanel.tsx` — Container for the board + Back/Forward/Undo/Ask buttons
- `components/ChessBoard.tsx` — Interactive board (`react-chessboard`), highlights legal moves, shows engine arrow
- `components/ChatWindow.tsx` — Chat message display + input
- `components/PersonalitySelector.tsx` — GM dropdown
- `hooks/useStockfish.ts` — Manages Stockfish WASM analysis; falls back to Lichess API if WASM unavailable

**Backend** (`server/`) — Express on port 3001
- `server/index.js` — Single `/api/chat` POST endpoint; builds prompt, calls Claude API, returns response
- `server/gmPersonalities.js` — System prompt definitions for each GM persona

**Chat request payload** sent from frontend to `/api/chat`:
```json
{
  "message": "user question",
  "personality": "magnus|hikaru|bobby",
  "fen": "current board FEN",
  "bestMove": "Stockfish best move",
  "conversationHistory": [...]
}
```

## Key Technical Details

- **Stockfish**: Loaded as WASM via dynamic import. Vite config resolves `stockfish/src/stockfish-nnue-16-no-simd.js` path and excludes it from bundling to avoid build issues.
- **Chess logic**: `chess.js` for move validation, FEN parsing, legal move generation.
- **Claude model**: `claude-sonnet-4-5-20250929` called server-side via `@anthropic-ai/sdk`.
- **Components unused**: `ControlPanel.tsx` and `MoveAnalysis.tsx` exist but are not rendered.
