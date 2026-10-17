import { PIECE_ART, type PieceCode } from "../data/pieceArt";

interface PieceIconProps {
  piece: PieceCode;
  className?: string;
}

/** A piece as a small figurine, drawn from the same artwork as the pieces on the board. */
export default function PieceIcon({ piece, className }: PieceIconProps) {
  return (
    <svg
      viewBox="0 0 45 45"
      className={className}
      aria-hidden="true"
      focusable="false"
      // The artwork is a fixed, bundled string (src/data/pieceArt.ts), never user input.
      dangerouslySetInnerHTML={{ __html: PIECE_ART[piece] }}
    />
  );
}
