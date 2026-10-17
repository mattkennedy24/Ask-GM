import { useId, useRef, useState } from "react";
import type { ImportResult } from "../lib/importGame";
import Dialog from "./Dialog";

interface LoadGameDialogProps {
  /** Tries to put the pasted text on the board; the dialog stays open and shows the message if it cannot. */
  onLoad: (text: string) => ImportResult;
  onClose: () => void;
}

/** Paste a PGN or a FEN to analyse your own game. */
export default function LoadGameDialog({ onLoad, onClose }: LoadGameDialogProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const errorId = useId();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = onLoad(text);
    if (!result.ok) {
      setError(result.error);
      field.current?.focus();
    }
  };

  return (
    <Dialog title="Load a game" description="Paste a PGN from any chess site, or a single FEN position." onClose={onClose} initialFocus={field}>
      <form onSubmit={submit} className="stack" noValidate>
        <textarea
          ref={field}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            if (error) setError(null);
          }}
          placeholder={"1. e4 e5 2. Nf3 Nc6 3. Bb5 …"}
          aria-label="Game in PGN or FEN"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="field"
        />
        <p id={errorId} role="alert" className="type-small error">
          {error}
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={text.trim() === ""}>
            Load
          </button>
        </div>
      </form>
    </Dialog>
  );
}
