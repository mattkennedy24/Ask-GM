/**
 * Runtime configuration, read once at startup from the environment.
 *
 * Kept free of side effects (no dotenv, no process.env access at import time)
 * so tests can build a config from a plain object.
 */

export const DEFAULT_MODEL = "claude-sonnet-4-6";

/**
 * Trim whitespace and one layer of matching wrapping quotes.
 *
 * Hosting dashboards (Railway, Heroku, ...) store values verbatim, so a secret
 * pasted as `"my-code"` or with a trailing newline would otherwise never match
 * what the user types into the access-code box.
 */
export function normalizeSecret(value) {
  if (typeof value !== "string") return "";
  let v = value.trim();
  if (v.length >= 2) {
    const first = v[0];
    const last = v[v.length - 1];
    if ((first === '"' || first === "'") && first === last) {
      v = v.slice(1, -1).trim();
    }
  }
  return v;
}

/**
 * Express `trust proxy` setting.
 *
 * Behind a single reverse proxy (Railway, Heroku, Render, ...) `req.ip` is only
 * correct when Express trusts exactly one hop. Trusting `true` would let any
 * client spoof its address through X-Forwarded-For and dodge rate limits.
 */
export function parseTrustProxy(raw, isProduction) {
  if (raw === undefined || raw === "") return isProduction ? 1 : false;
  const v = String(raw).trim().toLowerCase();
  if (v === "false" || v === "0") return false;
  if (v === "true") return true;
  const n = Number.parseInt(v, 10);
  if (Number.isInteger(n) && n > 0) return n;
  return v; // e.g. "loopback" or a CIDR list, passed straight to Express
}

export function loadConfig(env = process.env) {
  const isProduction = env.NODE_ENV === "production";
  const port = Number.parseInt(env.PORT ?? "", 10);
  const apiKey = normalizeSecret(env.ANTHROPIC_API_KEY);

  return {
    isProduction,
    port: Number.isInteger(port) && port > 0 ? port : 3001,
    anthropicApiKey: apiKey,
    hasApiKey: apiKey !== "" && apiKey !== "your-api-key-here",
    model: normalizeSecret(env.ANTHROPIC_MODEL) || DEFAULT_MODEL,
    betaPasscode: normalizeSecret(env.BETA_PASSCODE),
    trustProxy: parseTrustProxy(env.TRUST_PROXY, isProduction),
  };
}
