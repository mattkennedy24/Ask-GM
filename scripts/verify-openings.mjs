#!/usr/bin/env node
/**
 * Engine check for the opening lessons in src/data/openings.ts.
 *
 * `npm test` already proves every line is legal chess. This proves the lines are *sound*:
 * it runs Stockfish over every position, then reports
 *   - any move that gives up more than MAX_LOSS centipawns (a lesson must not teach a blunder), and
 *   - any line that ends clearly better for one side.
 *
 * Usage:  npm run verify:openings            (about a minute)
 *         MAX_LOSS=80 MAX_FINAL=100 npm run verify:openings
 *
 * Lines that are deliberate gambits belong in INTENTIONAL below, with the reason.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(path.join(root, "package.json"));
const { Chess } = require("chess.js");

const MAX_LOSS = Number(process.env.MAX_LOSS ?? 120); // centipawns a single move may give up
const MAX_FINAL = Number(process.env.MAX_FINAL ?? 150); // |evaluation| a line may end on
const DEPTH = Number(process.env.DEPTH ?? 12);
const MOVETIME = Number(process.env.MOVETIME ?? 1500);

/** "<opening> / <variation>" (or just the opening) → why it is allowed to look unbalanced. */
const INTENTIONAL = new Map([
  ["Italian Game / Fried Liver Attack", "a gambit: White sacrifices a knight for an attack, and the notes point out the safer 5...Na5"],
]);

// ── load the lesson data (TypeScript) ──────────────────────────────────
const source = fs.readFileSync(path.join(root, "src/data/openings.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const tmp = path.join(fs.mkdtempSync(path.join(root, "node_modules/.verify-openings-")), "openings.mjs");
fs.writeFileSync(tmp, compiled);
const { OPENINGS } = await import(pathToFileURL(tmp).href);
fs.rmSync(path.dirname(tmp), { recursive: true, force: true });

// ── Stockfish (single-threaded WASM build) in this process ─────────────
const enginePath = path.join(root, "node_modules/stockfish/src/stockfish-nnue-16-single.js");
const wasmPath = path.join(path.dirname(enginePath), "stockfish-nnue-16-single.wasm");
const engine = await require(enginePath)()({ locateFile: (file) => (file.includes(".wasm") ? wasmPath : enginePath) });

let waiting = null;
let latest = null;
engine.addMessageListener((raw) => {
  const line = String(raw);
  if (line.startsWith("info") && line.includes(" score ") && !/ (lower|upper)bound /.test(line)) {
    const match = / depth (\d+) .*? score (cp|mate) (-?\d+)/.exec(line);
    if (match) latest = { depth: Number(match[1]), kind: match[2], value: Number(match[3]) };
  } else if ((line.startsWith("bestmove") || line === "readyok") && waiting) {
    const resolve = waiting;
    waiting = null;
    resolve();
  }
});
const send = (command) => engine.onCustomMessage(command);
const ask = (command) => new Promise((resolve) => ((waiting = resolve), send(command)));
send("uci");
await new Promise((resolve) => setTimeout(resolve, 300));
send("setoption name Hash value 64");
await ask("isready");

/** Centipawns from the side to move's point of view; mate scores become large but finite. */
async function evaluate(fen) {
  latest = { depth: 0, kind: "cp", value: 0 };
  send(`position fen ${fen}`);
  await ask(`go depth ${DEPTH} movetime ${MOVETIME}`);
  return latest.kind === "mate" ? (latest.value > 0 ? 10000 - latest.value : -10000 - latest.value) : latest.value;
}

const cache = new Map();
const key = (fen) => fen.split(" ").slice(0, 4).join(" ");
async function cachedEval(fen) {
  const id = key(fen);
  if (!cache.has(id)) cache.set(id, await evaluate(fen));
  return cache.get(id);
}

// ── walk every line ────────────────────────────────────────────────────
const lines = [];
for (const opening of OPENINGS) {
  lines.push({ label: opening.name, moves: opening.moves });
  for (const variation of opening.variations ?? []) lines.push({ label: `${opening.name} / ${variation.name}`, moves: variation.moves });
}

const problems = [];
let checked = 0;
for (const line of lines) {
  const chess = new Chess();
  let before = await cachedEval(chess.fen()); // side to move's view
  let beforeTurn = chess.turn();
  for (let ply = 0; ply < line.moves.length; ply++) {
    const uci = line.moves[ply];
    const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    const after = await cachedEval(chess.fen()); // opponent's view
    const loss = before + after; // mover's best value before, minus the mover's value after (= -after)
    checked++;
    if (loss >= MAX_LOSS && !INTENTIONAL.has(line.label)) {
      const number = Math.floor(ply / 2) + 1;
      problems.push(`${line.label}: ${number}${beforeTurn === "w" ? "." : "..."}${move.san} gives up ${(loss / 100).toFixed(2)} pawns`);
    }
    before = after;
    beforeTurn = chess.turn();
  }
  const whitePov = chess.turn() === "w" ? before : -before;
  if (Math.abs(whitePov) > MAX_FINAL && !INTENTIONAL.has(line.label)) {
    problems.push(`${line.label}: ends ${whitePov > 0 ? "+" : ""}${(whitePov / 100).toFixed(2)} (White's view), which is not a balanced lesson`);
  }
}

send("quit");
console.log(`Checked ${checked} moves in ${lines.length} lines (${cache.size} positions, depth ${DEPTH}).`);
if (problems.length === 0) {
  console.log("All opening lines are engine-sound.");
  process.exit(0);
}
console.error(`\n${problems.length} problem(s):`);
for (const problem of problems) console.error(`  - ${problem}`);
process.exit(1);
