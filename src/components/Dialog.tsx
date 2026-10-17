import { type ReactNode, useEffect, useId, useRef } from "react";

interface DialogProps {
  /** A small line above the title (the wordmark, for the access-code gate). */
  kicker?: ReactNode;
  title: string;
  description?: string;
  /** Omit to make the dialog impossible to dismiss (the access-code gate). */
  onClose?: () => void;
  children: ReactNode;
  /** Which element gets focus first; defaults to the first field or button. */
  initialFocus?: React.RefObject<HTMLElement | null>;
}

/**
 * A modal dialog. The page behind it is made inert by the app while it is open, so focus cannot wander
 * off; this handles the rest: labelling, Escape, a click on the backdrop, first focus and giving focus back.
 */
export default function Dialog({ kicker, title, description, onClose, children, initialFocus }: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const target = initialFocus?.current ?? panel.current?.querySelector<HTMLElement>("input, textarea, button");
    target?.focus();
    return () => before?.focus?.();
  }, [initialFocus]);

  useEffect(() => {
    if (!onClose) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" onPointerDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="dialog"
      >
        <header className="dialog-head">
          {kicker}
          <h2 id={titleId} className="type-display">
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="type-body soft">
              {description}
            </p>
          )}
        </header>
        {children}
      </div>
    </div>
  );
}
