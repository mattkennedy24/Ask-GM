import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import { Chess } from "chess.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import gmPersonalities from "./gmPersonalities.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const betaMiddleware = (req, res, next) => {
  const passcode = process.env.BETA_PASSCODE;
  if (!passcode) return next();
  const provided = req.headers["x-beta-key"];
  if (provided !== passcode) {
    return res.status(401).json({ error: "Beta access required" });
  }
  next();
};
app.use("/api", betaMiddleware);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../dist")));
}

if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "your-api-key-here") {
  console.error(
    "\n⚠️  ANTHROPIC_API_KEY is not set.\n" +
    "   Copy .env.example to .env and add your key:\n" +
    "   cp .env.example .env\n"
  );
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Format a centipawn score as a human-readable eval string.
 * e.g. 35 → "+0.35", -120 → "-1.20", mate 3 → "#3", mate -2 → "#-2"
 */
function formatEval(score, mate) {
  if (mate !== null && mate !== undefined) {
    return mate > 0 ? `#${mate}` : `#${mate}`;
  }
  if (score === null || score === undefined) return "?";
  if (score >= 9999) return "#";
  if (score <= -9999) return "#";
  const pawns = (score / 100).toFixed(2);
  return score >= 0 ? `+${pawns}` : `${pawns}`;
}

/**
 * Convert a UCI PV array to SAN notation with move numbers.
 * e.g. ["e2e4", "e7e5", "g1f3"] from starting pos → "1. e4 e5 2. Nf3"
 */
function formatPvLine(fen, pvMoves, maxMoves = 6) {
  const chess = new Chess(fen);
  const startMoveNum = chess.moveNumber();
  const startsWhite = chess.turn() === "w";
  const parts = [];

  pvMoves.slice(0, maxMoves).forEach((uci, i) => {
    try {
      const result = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4] ?? "q",
      });
      if (!result) return;

      const isWhite = startsWhite ? i % 2 === 0 : i % 2 === 1;
      const moveNum = startMoveNum + Math.floor((i + (startsWhite ? 0 : 1)) / 2);

      if (isWhite) parts.push(`${moveNum}.`);
      else if (i === 0) parts.push(`${moveNum}...`); // black to move first
      parts.push(result.san);
    } catch {
      // Stop on any illegal move
    }
  });

  return parts.join(" ");
}

/**
 * Build the system prompt combining GM personality with structured chess context.
 *
 * Architecture: Stockfish provides all candidate moves. Claude's role is to explain
 * and coach — never to invent moves from scratch.
 */
function buildSystemPrompt(selectedGM, currentFen, moveHistory, topLines) {
  const gm = gmPersonalities[selectedGM];
  if (!gm) throw new Error(`Unknown GM personality: ${selectedGM}`);

  // --- Position context ---
  let chessContext = `\n\nCURRENT POSITION:\n`;
  chessContext += `FEN: ${currentFen}\n`;

  if (moveHistory && moveHistory.length > 0) {
    const formatted = moveHistory.reduce((acc, san, i) => {
      if (i % 2 === 0) return acc + `${Math.floor(i / 2) + 1}. ${san} `;
      return acc + `${san} `;
    }, "").trim();
    chessContext += `Game so far: ${formatted}\n`;
  }

  // --- Legal moves (hard constraint reference) ---
  try {
    const chess = new Chess(currentFen);
    const legalMoves = chess.moves();
    if (legalMoves.length > 0) {
      chessContext += `Legal moves: ${legalMoves.join(", ")}\n`;
    }
  } catch {
    // Position may be terminal — no legal moves
  }

  // --- Engine analysis (forced menu) ---
  if (topLines && topLines.length > 0) {
    chessContext += `\nENGINE ANALYSIS (Stockfish — top lines):\n`;
    chessContext += `These are the only moves you are permitted to recommend. Do not suggest any move not listed here.\n`;

    topLines.forEach((line, i) => {
      if (!line.pv || line.pv.length === 0) return;
      const evalStr = formatEval(line.score, line.mate);
      const sanLine = formatPvLine(currentFen, line.pv, 6);
      if (sanLine) {
        chessContext += `Line ${i + 1} (${evalStr}): ${sanLine}\n`;
      }
    });
  } else {
    chessContext += `\nEngine analysis is not yet available for this position.\n`;
    chessContext += `If asked for a specific move, acknowledge that you are still evaluating and offer positional/strategic guidance only.\n`;
  }

  // --- Response instructions ---
  chessContext += `\nRESPONSE INSTRUCTIONS:\n`;
  chessContext += `- Respond in character as ${gm.name} at all times.\n`;
  chessContext += `- You MUST only recommend moves that appear in the engine lines above. Never invent, guess, or suggest any other move.\n`;
  chessContext += `- Match response length to the question: simple questions ("what should I play?") → 1-2 sentences. Positional or strategic questions → up to 4-5 sentences.\n`;
  chessContext += `- When citing a move, use the SAN notation from the engine lines (e.g. "Nf3 is the right move here").\n`;
  chessContext += `- Reference specific squares and pieces to ground your advice in the actual position.\n`;
  chessContext += `- If asked something unrelated to chess, briefly redirect in character.\n`;

  return gm.systemPrompt + chessContext;
}

/**
 * POST /api/chat
 *
 * Body: {
 *   selectedGM: string,
 *   currentFen: string,
 *   question: string,
 *   conversationHistory: Array<{ role: string, content: string }>,
 *   moveHistory?: string[],
 *   topLines?: Array<{ pv: string[], score: number | null, mate: number | null }>
 * }
 */
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,             // max 20 requests per IP per minute
  message: { error: "Too many requests. Please wait a moment before asking again." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.post("/api/chat", chatLimiter, async (req, res) => {
  try {
    const { selectedGM, currentFen, question, conversationHistory, moveHistory, topLines } = req.body;

    if (!question || !currentFen || !selectedGM) {
      return res.status(400).json({ error: "Missing required fields: question, currentFen, selectedGM" });
    }

    const systemPrompt = buildSystemPrompt(selectedGM, currentFen, moveHistory, topLines);

    const messages = [];

    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory) {
        messages.push({
          role: msg.role === "You" ? "user" : "assistant",
          content: msg.content,
        });
      }
    }

    messages.push({ role: "user", content: question });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 450,
      system: systemPrompt,
      messages,
    });

    const text = response.content[0].text;
    res.json({ response: text });
  } catch (error) {
    console.error("Chat API error:", error.message);

    if (error.status === 401) {
      return res.status(401).json({
        error: "Invalid API key. Check your ANTHROPIC_API_KEY in .env",
      });
    }

    res.status(500).json({ error: "Failed to get response from Claude API" });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", hasApiKey: !!process.env.ANTHROPIC_API_KEY });
});

if (process.env.NODE_ENV === "production") {
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(__dirname, "../dist", "index.html"));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Ask-GM server running on http://localhost:${PORT}`);
});
