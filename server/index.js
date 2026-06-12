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
function formatPvLine(fen, pvMoves, maxMoves = 7) {
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
      else if (i === 0) parts.push(`${moveNum}...`);
      parts.push(result.san);
    } catch {
      // Stop on any illegal move
    }
  });

  return parts.join(" ");
}

/**
 * Compute a human-readable material balance string from a FEN.
 * Returns something like "White is up a knight (+3)" or "Material is equal".
 */
function getMaterialBalance(fen) {
  const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  try {
    const chess = new Chess(fen);
    let whiteTotal = 0;
    let blackTotal = 0;

    for (const row of chess.board()) {
      for (const piece of row) {
        if (!piece || piece.type === "k") continue;
        const val = PIECE_VALUES[piece.type] ?? 0;
        if (piece.color === "w") whiteTotal += val;
        else blackTotal += val;
      }
    }

    const diff = whiteTotal - blackTotal;
    if (diff === 0) return "Material is equal.";
    const side = diff > 0 ? "White" : "Black";
    const abs = Math.abs(diff);
    if (abs >= 9) return `${side} is up a queen (+${abs} points).`;
    if (abs >= 5) return `${side} is up a rook (+${abs} points).`;
    if (abs >= 3) return `${side} is up a minor piece (+${abs} points).`;
    return `${side} is ahead by ${abs} pawn${abs > 1 ? "s" : ""}.`;
  } catch {
    return "Material balance unknown.";
  }
}

/**
 * Describe the position type (open/closed/semi-open) based on pawn structure.
 */
function getPositionType(fen) {
  try {
    const chess = new Chess(fen);
    let openFiles = 0;
    let totalPawns = 0;

    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    for (const file of files) {
      let hasWhitePawn = false;
      let hasBlackPawn = false;
      for (let rank = 1; rank <= 8; rank++) {
        const piece = chess.get(`${file}${rank}`);
        if (piece?.type === "p") {
          totalPawns++;
          if (piece.color === "w") hasWhitePawn = true;
          else hasBlackPawn = true;
        }
      }
      if (!hasWhitePawn && !hasBlackPawn) openFiles++;
    }

    if (totalPawns <= 8) return "endgame (few pawns remaining)";
    if (openFiles >= 3) return "open (many open files, piece activity is key)";
    if (openFiles >= 1) return "semi-open (mixed, balance of positional and tactical play)";
    return "closed (blocked pawn structure, long-term maneuvering)";
  } catch {
    return "unknown";
  }
}

/**
 * Check king safety — is each king still castled or has it moved to the center?
 */
function getKingSafety(fen) {
  try {
    const chess = new Chess(fen);
    const notes = [];

    for (const color of ["w", "b"]) {
      const label = color === "w" ? "White" : "Black";
      const squares = chess.findPiece({ type: "k", color });
      if (squares.length === 0) continue;
      const sq = squares[0];
      const file = sq[0];
      const rank = sq[1];

      const isKingsideCastled = (color === "w" && sq === "g1") || (color === "b" && sq === "g8");
      const isQueensideCastled = (color === "w" && sq === "c1") || (color === "b" && sq === "c8");
      const isCenter = ["d", "e"].includes(file) && ["3", "4", "5", "6"].includes(rank);

      if (isKingsideCastled) notes.push(`${label}'s king is safely castled kingside.`);
      else if (isQueensideCastled) notes.push(`${label}'s king is castled queenside.`);
      else if (isCenter) notes.push(`${label}'s king is in the CENTER — potentially vulnerable.`);
    }

    return notes.join(" ") || "King safety: both kings appear safe.";
  } catch {
    return "";
  }
}

/**
 * Build the system prompt combining GM personality with structured chess context.
 */
function buildSystemPrompt(selectedGM, currentFen, moveHistory, topLines, openingName) {
  const gm = gmPersonalities[selectedGM];
  if (!gm) throw new Error(`Unknown GM personality: ${selectedGM}`);

  const chess = (() => { try { return new Chess(currentFen); } catch { return null; } })();
  const isGameOver = chess ? (chess.isCheckmate() || chess.isDraw() || chess.isStalemate()) : false;
  const sideToMove = chess?.turn() === "w" ? "White" : "Black";
  const moveNum = chess?.moveNumber() ?? 1;

  // ── Chess context section ──
  let chessContext = `\n\n═══════════════════════════════════
CURRENT POSITION (Move ${moveNum}, ${sideToMove} to play)
═══════════════════════════════════\n`;
  chessContext += `FEN: ${currentFen}\n`;

  // Opening recognition
  if (openingName) {
    chessContext += `Opening: ${openingName}\n`;
  }

  // Move history
  if (moveHistory && moveHistory.length > 0) {
    const formatted = moveHistory.reduce((acc, san, i) => {
      if (i % 2 === 0) return acc + `${Math.floor(i / 2) + 1}. ${san} `;
      return acc + `${san} `;
    }, "").trim();
    chessContext += `Game moves so far: ${formatted}\n`;
  }

  // Position context
  const material = getMaterialBalance(currentFen);
  const posType = getPositionType(currentFen);
  const kingSafety = getKingSafety(currentFen);

  chessContext += `\nPOSITION ASSESSMENT:\n`;
  chessContext += `• ${material}\n`;
  chessContext += `• Position type: ${posType}\n`;
  if (kingSafety) chessContext += `• ${kingSafety}\n`;
  if (isGameOver) chessContext += `• The game is OVER (checkmate, draw, or stalemate).\n`;

  // Legal moves
  if (chess && !isGameOver) {
    const legalMoves = chess.moves();
    if (legalMoves.length > 0 && legalMoves.length <= 40) {
      chessContext += `• Legal moves: ${legalMoves.join(", ")}\n`;
    }
  }

  // Engine analysis
  if (topLines && topLines.length > 0) {
    chessContext += `\nSTOCKFISH ENGINE ANALYSIS (depth 18+):\n`;
    chessContext += `CRITICAL: You may ONLY recommend moves that appear in these lines. Never suggest any other move.\n`;

    topLines.forEach((line, i) => {
      if (!line.pv || line.pv.length === 0) return;
      const evalStr = formatEval(line.score, line.mate);
      const sanLine = formatPvLine(currentFen, line.pv, 7);
      if (sanLine) {
        const label = i === 0 ? "BEST" : `Alt ${i}`;
        chessContext += `[${label}] ${evalStr}: ${sanLine}\n`;
      }
    });
  } else {
    chessContext += `\nEngine analysis is loading or unavailable for this position.\n`;
    chessContext += `If asked for a specific move recommendation, acknowledge the analysis is still loading and offer strategic/conceptual guidance instead.\n`;
  }

  // Response instructions
  chessContext += `\nRESPONSE GUIDELINES:\n`;
  chessContext += `- Stay fully in character as ${gm.name} at ALL times. Your voice, personality, and chess philosophy must be unmistakable.\n`;
  chessContext += `- ONLY recommend moves from the engine lines above — never invent or guess moves.\n`;
  chessContext += `- Scale response length to the question: "Best move?" → 1-2 punchy sentences. Strategic/conceptual questions → 3-5 sentences.\n`;
  chessContext += `- Use standard SAN notation for moves (e.g., Nf3, Bxe5+, O-O, d4).\n`;
  chessContext += `- Reference concrete squares, pieces, and structures — ground your advice in THIS position.\n`;
  chessContext += `- When you explain WHY a move is good, connect it to the position's key features (material, king safety, pawn structure, piece activity).\n`;
  chessContext += `- If something is off-topic, redirect in character with a brief, sharp comment.\n`;

  return gm.systemPrompt + chessContext;
}

/**
 * Sanitize user input: strip control chars, enforce max length.
 */
function sanitizeInput(value, maxLen = 1000) {
  if (typeof value !== "string") return "";
  // Remove control characters (except \n \t which are fine in text)
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").slice(0, maxLen);
}

/**
 * Classify question to determine expected response length.
 * Returns "tactical" | "conceptual" | "theory"
 */
function classifyQuestion(question) {
  const q = question.toLowerCase();
  if (/\b(best move|what('s| is) the move|blunder|tactic|checkmate|mate in|combination|fork|pin|skewer|sacrifice|trap)\b/.test(q)) {
    return "tactical";
  }
  if (/\b(opening|theory|variation|line|gambit|sicilian|french|caro|slav|indian|ruy|london|catalan|nimzo|grünfeld|grunfeld)\b/.test(q)) {
    return "theory";
  }
  return "conceptual";
}

/**
 * Extract SAN tokens from a text string.
 */
function extractSanTokens(text) {
  const SAN_RE = /\b(O-O-O|O-O|[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[KQRBN])?[+#]?|[a-h][1-8]|[a-h]x[a-h][1-8](?:=[KQRBN])?[+#]?)\b/g;
  return [...text.matchAll(SAN_RE)].map(m => m[0]);
}

/**
 * Validate that all recommended moves in a response are legal in the position.
 * Returns { valid: boolean, illegalMoves: string[] }
 */
function validateResponseMoves(responseText, fen) {
  try {
    const chess = new Chess(fen);
    const legalSans = new Set(chess.moves());
    const mentioned = extractSanTokens(responseText);
    const illegalMoves = mentioned.filter(san => !legalSans.has(san));
    return { valid: illegalMoves.length === 0, illegalMoves };
  } catch {
    return { valid: true, illegalMoves: [] };
  }
}

/**
 * Parse FOLLOWUPS from a response and return { text, followUps }.
 * The model is instructed to append: FOLLOWUPS: q1 | q2 | q3
 */
function parseFollowUps(rawText) {
  const marker = /\nFOLLOWUPS:\s*(.+)$/i;
  const match = rawText.match(marker);
  if (!match) return { text: rawText.trim(), followUps: [] };

  const text = rawText.slice(0, match.index).trim();
  const followUps = match[1]
    .split("|")
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 3);
  return { text, followUps };
}

/**
 * POST /api/chat
 */
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Too many requests. Please wait a moment before asking again." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.post("/api/chat", chatLimiter, async (req, res) => {
  try {
    let { selectedGM, currentFen, question, conversationHistory, moveHistory, topLines, openingName } = req.body;

    if (!question || !currentFen || !selectedGM) {
      return res.status(400).json({ error: "Missing required fields: question, currentFen, selectedGM" });
    }

    // ── Input sanitization ──
    question = sanitizeInput(question, 1000);
    if (!question) return res.status(400).json({ error: "Question is empty after sanitization." });

    if (!Array.isArray(topLines)) topLines = [];
    topLines = topLines.slice(0, 5);

    if (!Array.isArray(conversationHistory)) conversationHistory = [];
    conversationHistory = conversationHistory.slice(-10);

    if (!Array.isArray(moveHistory)) moveHistory = [];
    moveHistory = moveHistory.slice(0, 200);

    // ── Question classification → response length hint ──
    const qClass = classifyQuestion(question);
    const lengthHint =
      qClass === "tactical"   ? "1-2 punchy sentences (it's a direct move question)" :
      qClass === "theory"     ? "4-5 sentences (opening theory deserves context)" :
                                "3-4 sentences (strategic/conceptual question)";

    const systemPrompt = buildSystemPrompt(selectedGM, currentFen, moveHistory, topLines, openingName);

    // Append question classification + follow-up instructions to the system prompt
    const fullSystemPrompt = systemPrompt +
      `\n\nRESPONSE LENGTH FOR THIS QUESTION: ${lengthHint}\n` +
      `After your response, on a new line append exactly: FOLLOWUPS: <q1> | <q2> | <q3>\n` +
      `where q1/q2/q3 are 3 short natural follow-up questions a student might ask next (5-8 words each, chess-specific to this position). ` +
      `Do not number them. Do not put quotes around them. The FOLLOWUPS line must always be present.`;

    const messages = [];
    for (const msg of conversationHistory) {
      messages.push({
        role: msg.role === "You" ? "user" : "assistant",
        content: typeof msg.content === "string" ? sanitizeInput(msg.content, 2000) : "",
      });
    }
    messages.push({ role: "user", content: question });

    const callClaude = async () =>
      anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 700,
        system: fullSystemPrompt,
        messages,
      });

    let response = await callClaude();
    let rawText = response.content[0].text;

    // ── Move validation with single retry ──
    const { valid, illegalMoves } = validateResponseMoves(rawText, currentFen);
    if (!valid && illegalMoves.length > 0) {
      messages.push({ role: "assistant", content: rawText });
      messages.push({
        role: "user",
        content: `The move(s) ${illegalMoves.join(", ")} are not legal in this position. ` +
          `Please correct your response using only legal moves from the engine analysis provided.`,
      });
      response = await callClaude();
      rawText = response.content[0].text;
    }

    const { text, followUps } = parseFollowUps(rawText);
    res.json({ response: text, followUps });
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
