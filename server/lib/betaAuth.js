import crypto from "node:crypto";

/** Longest access code we will even look at; anything longer cannot be valid. */
const MAX_KEY_LENGTH = 256;

/**
 * Constant-time string comparison.
 *
 * Both values are hashed first so `timingSafeEqual` always sees equal-length
 * buffers and the comparison time does not leak the length of the real code.
 */
export function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * Build the beta-access gate for a configured passcode.
 *
 * When no passcode is configured the gate is open and `required` is false, which
 * the client reads from /api/auth/status so it never shows an access prompt that
 * the server would not enforce.
 */
export function createBetaAuth(passcode) {
  const expected = typeof passcode === "string" ? passcode : "";
  const required = expected !== "";

  function isValidKey(candidate) {
    if (!required) return true;
    if (typeof candidate !== "string") return false;
    const key = candidate.trim();
    if (key === "" || key.length > MAX_KEY_LENGTH) return false;
    return safeEqual(key, expected);
  }

  /** Express middleware: 401 unless the X-Beta-Key header carries the passcode. */
  function middleware(req, res, next) {
    if (isValidKey(req.get("x-beta-key"))) return next();
    return res.status(401).json({ error: "Beta access required", code: "BETA_KEY_INVALID" });
  }

  return { required, isValidKey, middleware };
}
