import { useMemo } from "react";
import { type CapturableType, summarizeMaterial } from "../lib/material";

const GLYPHS: Record<CapturableType, string> = { q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
const NAMES: Record<CapturableType, string> = { q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" };

interface CapturedPiecesProps {
  fen: string;
  /** Whose captures to show: "w" = the black pieces White has taken. */
  capturedBy: "w" | "b";
}

/** One row of captured pieces, with the material lead next to whichever side is ahead. */
export default function CapturedPieces({ fen, capturedBy }: CapturedPiecesProps) {
  const { pieces, lead } = useMemo(() => {
    const summary = summarizeMaterial(fen);
    const mine = capturedBy === "w" ? summary.capturedByWhite : summary.capturedByBlack;
    const ahead = capturedBy === "w" ? summary.advantage : -summary.advantage;
    return { pieces: mine, lead: ahead > 0 ? ahead : 0 };
  }, [fen, capturedBy]);

  // The glyph colour is the colour of the piece that was taken, not of the side that took it.
  const glyphStyle =
    capturedBy === "w"
      ? { color: "#1a1a1a", WebkitTextStroke: "0.8px #b4b4b4" } // black pieces, outlined to show on dark
      : { color: "#f0d9b5", textShadow: "0 0 2px #000, 0 0 4px #000" }; // white pieces

  const description = pieces.length > 0 ? `Captured: ${pieces.map((p) => NAMES[p]).join(", ")}` : "No captures";

  return (
    <div className="flex min-h-5 items-center gap-1.5 px-1" aria-label={description} role="img">
      <span className="text-base leading-none tracking-tighter" aria-hidden="true">
        {pieces.map((type, i) => (
          <span key={i} style={glyphStyle}>
            {GLYPHS[type]}
          </span>
        ))}
      </span>
      {lead > 0 && (
        <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--c-gold)", fontFamily: "var(--f-mono)" }} aria-hidden="true">
          +{lead}
        </span>
      )}
    </div>
  );
}
