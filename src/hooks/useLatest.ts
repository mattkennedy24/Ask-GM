import { useEffect, useRef } from "react";

/**
 * A ref that always holds the latest value. Lets a long-lived listener (a window
 * key handler, a timer) call the newest closure without being re-subscribed on
 * every render.
 */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
