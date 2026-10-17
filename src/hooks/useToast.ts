import { useCallback, useEffect, useRef, useState } from "react";

export interface ToastState {
  message: string;
  /** An optional one-tap follow-up, such as bringing back the game that was just cleared. */
  action?: { label: string; run: () => void };
}

const DURATION_MS = 6000;

/** One short message at a time, gone after a few seconds. */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback((next: ToastState) => {
    clearTimeout(timer.current);
    setToast(next);
    timer.current = setTimeout(() => setToast(null), DURATION_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);
  return { toast, show, dismiss };
}
