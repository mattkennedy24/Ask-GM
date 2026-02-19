import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
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
  if (!passcode) return next(); // disabled in local dev if env var not set
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

// Validate API key on startup
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
 * Build the system prompt by combining the GM personality with chess context.
 */
function buildSystemPrompt(selectedGM, currentFen, bestMove) {
  const gm = gmPersonalities[selectedGM];
  if (!gm) {
    throw new Error(`Unknown GM personality: ${selectedGM}`);
  }

  let chessContext = `\n\nCHESS CONTEXT:\n`;
  chessContext += `Current board position (FEN): ${currentFen}\n`;

  if (bestMove) {
    chessContext += `Stockfish engine recommendation: ${bestMove}\n`;
    chessContext += `You may reference the engine suggestion, agree or disagree with it, and explain your reasoning in your own style. You are not bound by the engine — you have your own chess intuition.\n`;
  }

  chessContext += `\nINSTRUCTIONS:\n`;
  chessContext += `- Respond in character as ${gm.name} at all times.\n`;
  chessContext += `- Analyze the position and answer the user's question about it.\n`;
  chessContext += `- Reference specific squares, pieces, and lines when relevant.\n`;
  chessContext += `- Keep responses focused and under 200 words unless a deeper analysis is clearly needed.\n`;
  chessContext += `- If the user asks a non-chess question, briefly steer back to chess in character.\n`;

  return gm.systemPrompt + chessContext;
}

/**
 * POST /api/chat
 *
 * Body: {
 *   selectedGM: string,       - "Magnus" | "Hikaru" | "Bobby"
 *   currentFen: string,       - FEN of the current board position
 *   bestMove: string | null,  - Stockfish recommended move (e.g. "e2e4")
 *   question: string,         - The user's current question
 *   conversationHistory: Array<{ role: string, content: string }>
 * }
 */
app.post("/api/chat", async (req, res) => {
  try {
    const { selectedGM, currentFen, bestMove, question, conversationHistory } = req.body;

    if (!question || !currentFen || !selectedGM) {
      return res.status(400).json({ error: "Missing required fields: question, currentFen, selectedGM" });
    }

    const systemPrompt = buildSystemPrompt(selectedGM, currentFen, bestMove);

    // Build messages array: include conversation history + current question
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
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
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

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", hasApiKey: !!process.env.ANTHROPIC_API_KEY });
});

if (process.env.NODE_ENV === "production") {
  app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "../dist", "index.html"));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Ask-GM server running on http://localhost:${PORT}`);
});
