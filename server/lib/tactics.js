import { Chess } from "chess.js";

/**
 * Concrete, checkable facts about the tactics and structure of a position.
 *
 * Language models are fluent about chess and unreliable about boards: left alone they
 * will happily call a defended knight "hanging". Everything here is computed from the
 * position with chess.js, so the grandmaster can build on facts instead of guessing them.
 * Each function returns plain strings (or an empty string/array when there is nothing
 * worth saying) so the prompt only mentions what is actually true.
 */

const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const NAME = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
const SIDE = { w: "White", b: "Black" };
const FILES = "abcdefgh";
const MAX_ITEMS = 4;
const MAX_MOVES_LISTED = 8;

const opposite = (color) => (color === "w" ? "b" : "w");

/** The same position with the other side to move, or null when that is meaningless or illegal. */
function withOtherSideToMove(chess) {
  if (chess.inCheck()) return null; // the side to move must answer the check first; "threats" are moot
  const [placement, turn, castling, , halfmove, fullmove] = chess.fen().split(" ");
  try {
    return new Chess([placement, turn === "w" ? "b" : "w", castling, "-", halfmove, fullmove].join(" "));
  } catch {
    return null;
  }
}

/**
 * What the side `side` nets by starting captures on `square`, if both sides keep recapturing
 * with their cheapest piece and may stop whenever continuing would lose material (a "static
 * exchange"). Works on a scratch board: each capture is made, the rest of the exchange is
 * evaluated, and the board is put back. Pieces that become attackers once the front piece
 * has left (x-rays and batteries) are found automatically because attackers are recomputed.
 */
function exchangeGain(chess, square, side) {
  const victim = chess.get(square);
  if (!victim || victim.type === "k") return 0;

  const attackers = chess
    .attackers(square, side)
    .map((from) => ({ from, piece: chess.get(from) }))
    .sort((a, b) => VALUE[a.piece.type] - VALUE[b.piece.type] || a.from.localeCompare(b.from));
  if (attackers.length === 0) return 0;

  const { from, piece } = attackers[0];
  const other = opposite(side);
  chess.remove(from);
  chess.put(piece, square);

  // A king may only capture when nothing is left to capture it back.
  const legal = piece.type !== "k" || chess.attackers(square, other).length === 0;
  const gain = legal ? Math.max(0, VALUE[victim.type] - exchangeGain(chess, square, other)) : 0;

  chess.put(victim, square);
  chess.put(piece, from);
  return gain;
}

/**
 * Enemy pieces the side to move can win by capturing right now, best prize first. The exchange
 * is evaluated statically; the capture shown is a legal one, so a pinned piece never gets credit.
 */
function winnableTargets(chess) {
  const mover = chess.turn();
  const cheapestCapture = new Map();
  for (const move of chess.moves({ verbose: true })) {
    if (!move.captured || move.flags.includes("e")) continue; // en passant: the victim is not on move.to
    const best = cheapestCapture.get(move.to);
    if (!best || VALUE[move.piece] < VALUE[best.piece]) cheapestCapture.set(move.to, move);
  }

  const scratch = new Chess(chess.fen());
  const targets = [];
  for (const [square, move] of cheapestCapture) {
    const gain = exchangeGain(scratch, square, mover);
    if (gain <= 0) continue;
    const defended = chess.attackers(square, opposite(mover)).length > 0;
    targets.push({ square, piece: move.captured, color: opposite(mover), move, gain, defended });
  }
  return targets.sort((a, b) => b.gain - a.gain || a.square.localeCompare(b.square));
}

function describeTarget({ square, piece, color, move, gain, defended }) {
  const victim = `${SIDE[color]}'s ${NAME[piece]} on ${square}`;
  return defended
    ? `${victim} is defended, but ${move.san} still nets about ${gain} point${gain === 1 ? "" : "s"}`
    : `${victim} is undefended: ${move.san} wins it`;
}

/**
 * What can be won by capture right now, and what the opponent would win if it were their move.
 * @returns {{ opportunities: string[], threats: string[] }}
 */
export function getPieceSafety(fen) {
  try {
    const chess = new Chess(fen);
    const opportunities = winnableTargets(chess).slice(0, MAX_ITEMS).map(describeTarget);

    const flipped = withOtherSideToMove(chess);
    const threats = flipped ? winnableTargets(flipped).slice(0, MAX_ITEMS).map(describeTarget) : [];
    return { opportunities, threats };
  } catch {
    return { opportunities: [], threats: [] };
  }
}

function collectPawns(chess) {
  const pawns = { w: [], b: [] };
  for (const row of chess.board()) {
    for (const piece of row) {
      if (piece?.type === "p") pawns[piece.color].push({ file: FILES.indexOf(piece.square[0]), rank: Number(piece.square[1]), square: piece.square });
    }
  }
  return pawns;
}

/** Passed, isolated and doubled pawns for each side, as one sentence per side that has any. */
export function getPawnStructure(fen) {
  try {
    const pawns = collectPawns(new Chess(fen));
    const sentences = [];

    for (const color of ["w", "b"]) {
      const mine = pawns[color];
      const theirs = pawns[opposite(color)];
      const notes = [];

      for (const pawn of mine) {
        const blocked = theirs.some(
          (enemy) => Math.abs(enemy.file - pawn.file) <= 1 && (color === "w" ? enemy.rank > pawn.rank : enemy.rank < pawn.rank),
        );
        if (blocked) continue;
        const steps = color === "w" ? 8 - pawn.rank : pawn.rank - 1;
        notes.push(`a passed pawn on ${pawn.square} (${steps} step${steps === 1 ? "" : "s"} from promotion)`);
      }

      // A side with a single pawn is trivially "isolated"; that tells the student nothing.
      const isolated =
        mine.length < 2 ? [] : mine.filter((pawn) => !mine.some((other) => Math.abs(other.file - pawn.file) === 1));
      if (isolated.length) notes.push(`isolated pawn${isolated.length > 1 ? "s" : ""} on ${isolated.map((pawn) => pawn.square).join(", ")}`);

      const doubledFiles = [...new Set(mine.map((pawn) => pawn.file))].filter((file) => mine.filter((pawn) => pawn.file === file).length > 1);
      if (doubledFiles.length) notes.push(`doubled pawns on the ${doubledFiles.map((file) => FILES[file]).join(" and ")}-file`);

      if (notes.length) sentences.push(`${SIDE[color]} has ${notes.join("; ")}.`);
    }
    return sentences.join(" ");
  } catch {
    return "";
  }
}

const isLightSquare = (square) => (FILES.indexOf(square[0]) + Number(square[1])) % 2 === 0;

/** The bishop pair and opposite-coloured bishops: small facts that shape whole plans. */
export function getBishopFacts(fen) {
  try {
    const chess = new Chess(fen);
    const bishops = { w: [], b: [] };
    for (const row of chess.board()) {
      for (const piece of row) if (piece?.type === "b") bishops[piece.color].push(isLightSquare(piece.square));
    }

    const hasPair = (color) => bishops[color].includes(true) && bishops[color].includes(false);
    const notes = [];
    if (hasPair("w") && !hasPair("b")) notes.push("White has the bishop pair.");
    else if (hasPair("b") && !hasPair("w")) notes.push("Black has the bishop pair.");

    if (bishops.w.length === 1 && bishops.b.length === 1 && bishops.w[0] !== bishops.b[0]) {
      notes.push("The bishops are on opposite colors.");
    }
    return notes.join(" ");
  } catch {
    return "";
  }
}

/** Checks and captures the side to move can play, as SAN. */
export function getTacticalMoves(fen) {
  try {
    const moves = new Chess(fen).moves({ verbose: true });
    return {
      checks: moves.filter((move) => /[+#]$/.test(move.san)).map((move) => move.san).slice(0, MAX_MOVES_LISTED),
      captures: moves.filter((move) => move.captured).map((move) => move.san).slice(0, MAX_MOVES_LISTED),
    };
  } catch {
    return { checks: [], captures: [] };
  }
}

/**
 * Everything above as ready-to-print prompt bullets (without the leading "• ").
 * Empty when the game is over: there is nothing left to capture or threaten.
 */
export function getTacticalFacts(fen) {
  let chess;
  try {
    chess = new Chess(fen);
  } catch {
    return [];
  }
  if (chess.isGameOver()) return [];

  const mover = SIDE[chess.turn()];
  const waiting = SIDE[opposite(chess.turn())];
  const facts = [];

  const structure = getPawnStructure(fen);
  if (structure) facts.push(`Pawn structure: ${structure}`);
  const bishops = getBishopFacts(fen);
  if (bishops) facts.push(`Bishops: ${bishops}`);

  const { opportunities, threats } = getPieceSafety(fen);
  if (opportunities.length) facts.push(`${mover} can win material by capturing: ${opportunities.join("; ")}.`);
  if (threats.length) facts.push(`Threats from ${waiting} (what it wins next if nothing is done): ${threats.join("; ")}.`);

  const { checks, captures } = getTacticalMoves(fen);
  if (checks.length) facts.push(`Checks available to ${mover}: ${checks.join(", ")}`);
  if (captures.length) facts.push(`Captures available to ${mover}: ${captures.join(", ")}`);
  return facts;
}
