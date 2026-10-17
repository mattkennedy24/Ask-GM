import { useMemo } from "react";
import type { PieceCode } from "../data/pieceArt";
import { type CapturableType, summarizeMaterial } from "../lib/material";
import PieceIcon from "./PieceIcon";

const NAMES: Record<CapturableType, string> = { q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" };

interface CapturedPiecesProps {
  fen: string;
  /** The board is flipped: Black's captures go on the left, nearest the player at the bottom. */
  flipped: boolean;
}

function Side({ fen, capturedBy }: { fen: string; capturedBy: "w" | "b" }) {
  const { pieces, lead } = useMemo(() => {
    const summary = summarizeMaterial(fen);
    const mine = capturedBy === "w" ? summary.capturedByWhite : summary.capturedByBlack;
    const ahead = capturedBy === "w" ? summary.advantage : -summary.advantage;
    return { pieces: mine, lead: ahead > 0 ? ahead : 0 };
  }, [fen, capturedBy]);

  // The figurine is drawn in the colour of the piece that was taken, not of the side that took it.
  const taken = capturedBy === "w" ? "b" : "w";
  const side = capturedBy === "w" ? "White" : "Black";
  const description = pieces.length > 0 ? `${side} has captured: ${pieces.map((p) => NAMES[p]).join(", ")}` : `${side} has captured nothing`;

  return (
    <div className="captured" role="img" aria-label={description}>
      <span className="type-label muted" aria-hidden="true">
        {side}
      </span>
      <span className="captured-pieces" aria-hidden="true">
        {pieces.map((type, i) => (
          <PieceIcon key={i} piece={`${taken}${type.toUpperCase()}` as PieceCode} className="captured-piece" />
        ))}
      </span>
      {lead > 0 && (
        <span className="type-small num soft" aria-hidden="true">
          +{lead}
        </span>
      )}
    </div>
  );
}

/** What each side has taken, in one row under the board. */
export default function CapturedPieces({ fen, flipped }: CapturedPiecesProps) {
  return (
    <div className="captures">
      <Side fen={fen} capturedBy={flipped ? "b" : "w"} />
      <Side fen={fen} capturedBy={flipped ? "w" : "b"} />
    </div>
  );
}
