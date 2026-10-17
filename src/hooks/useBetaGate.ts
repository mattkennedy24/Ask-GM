import { useCallback, useEffect, useState } from "react";
import { ApiError, getAuthStatus, verifyBetaKey } from "../lib/api";
import { readStorage, removeStorage, writeStorage } from "../lib/storage";

const STORAGE_KEY = "betaKey";

/**
 * checking – asking the server whether an access code is needed (the app is usable meanwhile)
 * open     – no code needed, or the stored code was accepted
 * locked   – an access code is required and we don't have a valid one
 */
export type BetaGateStatus = "checking" | "open" | "locked";

export interface UnlockResult {
  ok: boolean;
  error?: string;
}

/**
 * The beta access gate. Unlike the old client-side check, a code is only stored
 * after the *server* has accepted it, a stored code is re-verified on load, and a
 * 401 from any later request (code rotated or revoked) puts the gate back up.
 */
export function useBetaGate() {
  const [status, setStatus] = useState<BetaGateStatus>("checking");
  const [betaKey, setBetaKey] = useState<string | null>(() => readStorage(STORAGE_KEY));

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const { betaRequired } = await getAuthStatus();
        if (cancelled) return;
        if (!betaRequired) return setStatus("open");

        const stored = readStorage(STORAGE_KEY);
        if (!stored) return setStatus("locked");

        try {
          await verifyBetaKey(stored);
          if (!cancelled) setStatus("open");
        } catch (error) {
          if (cancelled) return;
          if (error instanceof ApiError && error.status === 401) {
            removeStorage(STORAGE_KEY);
            setBetaKey(null);
            setStatus("locked");
          } else {
            setStatus("open"); // couldn't verify (offline, rate-limited): don't lock out a returning user
          }
        }
      } catch {
        // The status endpoint is unreachable. Stay usable; a chat request will surface the real problem.
        if (!cancelled) setStatus("open");
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Verify a code with the server; stores it and opens the gate only if it is accepted. */
  const unlock = useCallback(async (code: string): Promise<UnlockResult> => {
    const trimmed = code.trim();
    if (!trimmed) return { ok: false, error: "Enter your access code." };
    try {
      await verifyBetaKey(trimmed);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) return { ok: false, error: "That access code isn't valid. Check it and try again." };
        return { ok: false, error: error.message };
      }
      return { ok: false, error: "Something went wrong. Please try again." };
    }
    writeStorage(STORAGE_KEY, trimmed);
    setBetaKey(trimmed);
    setStatus("open");
    return { ok: true };
  }, []);

  /** Put the gate back up, e.g. after the server rejected a stored code. */
  const lock = useCallback(() => {
    removeStorage(STORAGE_KEY);
    setBetaKey(null);
    setStatus("locked");
  }, []);

  return { status, betaKey, unlock, lock };
}
