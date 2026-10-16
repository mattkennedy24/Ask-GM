import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { createBetaAuth } from "./lib/betaAuth.js";
import { createCoach, EmptyResponseError } from "./lib/coach.js";
import { validateChatPayload } from "./lib/sanitize.js";

const DEFAULT_LIMITS = Object.freeze({ chatPerMinute: 20, verifyFailuresPerMinute: 10 });

/** Turn a failure from the model API into a status code and a message that is safe to show. */
function describeFailure(error) {
  const status = error?.status;
  if (error instanceof EmptyResponseError) {
    return { status: 502, message: "The grandmaster had nothing to say. Try rephrasing your question." };
  }
  if (error?.name === "APIConnectionTimeoutError") {
    return { status: 504, message: "The grandmaster took too long to answer. Please try again." };
  }
  // A bad or revoked server-side API key must never look like a bad beta code (401) to the browser.
  if (status === 401 || status === 403) {
    return { status: 502, message: "The coaching service is misconfigured.", alert: true };
  }
  if (status === 429) {
    return { status: 503, message: "The grandmaster is swamped right now. Try again in a moment." };
  }
  if (error?.name === "APIConnectionError" || status >= 500) {
    return { status: 503, message: "The coaching service is temporarily unavailable. Try again in a moment." };
  }
  return { status: 500, message: "Failed to get a response from the grandmaster." };
}

/** Long-lived caching for fingerprinted/versioned files; everything else revalidates. */
function setStaticCacheHeaders(res, filePath) {
  const immutable = /[\\/](assets|engine)[\\/]/.test(filePath);
  res.setHeader("Cache-Control", immutable ? "public, max-age=31536000, immutable" : "public, max-age=3600");
}

/**
 * Build the Express application.
 *
 * Everything environment-specific is injected so tests can run the real routing
 * and middleware without a network, an API key or a build directory.
 *
 * @param {object} options
 * @param {ReturnType<typeof import("./config.js").loadConfig>} options.config
 * @param {{ messages: { create: Function } }} options.anthropic
 * @param {Record<string, { name: string, systemPrompt: string }>} options.personalities
 * @param {string} [options.distDir] built frontend to serve, if it exists
 * @param {{ chatPerMinute?: number, verifyFailuresPerMinute?: number }} [options.limits]
 * @param {Pick<Console, "warn" | "error">} [options.logger]
 */
export function createApp({ config, anthropic, personalities, distDir, limits = {}, logger = console }) {
  const app = express();
  const beta = createBetaAuth(config.betaPasscode);
  const coach = createCoach({ anthropic, model: config.model, personalities, logger });
  const { chatPerMinute, verifyFailuresPerMinute } = { ...DEFAULT_LIMITS, ...limits };

  // Behind Railway's proxy req.ip is the proxy unless Express is told to trust one hop.
  // Without this every visitor shares a single rate-limit bucket.
  app.set("trust proxy", config.trustProxy);

  app.use(compression());
  app.use(cors());
  app.use(express.json({ limit: "64kb" }));

  const chatLimiter = rateLimit({
    windowMs: 60_000,
    limit: chatPerMinute,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please wait a moment before asking again." },
  });

  // Only failed attempts count, so a legitimate user is never locked out by successful logins,
  // while guessing the access code is throttled.
  const verifyLimiter = rateLimit({
    windowMs: 60_000,
    limit: verifyFailuresPerMinute,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many attempts. Please wait a minute and try again.", code: "RATE_LIMITED" },
  });

  // ── API ──────────────────────────────────────────────────────────────
  // Health stays public (and minimal) so the platform's health check works without a beta key.
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  // Lets the client know whether to ask for an access code at all.
  app.get("/api/auth/status", (_req, res) => res.json({ betaRequired: beta.required }));

  // The access-code prompt calls this with the candidate code in X-Beta-Key.
  app.post("/api/auth/verify", verifyLimiter, beta.middleware, (_req, res) => res.json({ ok: true }));

  app.post("/api/chat", chatLimiter, beta.middleware, async (req, res) => {
    if (!config.hasApiKey) {
      return res.status(503).json({ error: "The grandmasters are not available right now." });
    }

    const parsed = validateChatPayload(req.body, coach.isKnownGM);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    try {
      return res.json(await coach.ask(parsed.value));
    } catch (error) {
      const failure = describeFailure(error);
      const log = failure.alert ? logger.error : logger.warn;
      log.call(logger, `[chat] ${error?.name ?? "Error"}: ${error?.message ?? error} (upstream status ${error?.status ?? "n/a"})`);
      return res.status(failure.status).json({ error: failure.message });
    }
  });

  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

  // ── Frontend ─────────────────────────────────────────────────────────
  if (distDir && fs.existsSync(path.join(distDir, "index.html"))) {
    app.use(express.static(distDir, { index: false, setHeaders: setStaticCacheHeaders }));

    // Single-page-app fallback. A request for a missing *file* must 404: answering a
    // stale /assets/*.js URL with index.html (200) shows up as "Unexpected token '<'".
    app.get("/{*path}", (req, res) => {
      if (path.extname(req.path)) return res.status(404).type("text/plain").send("Not found");
      res.setHeader("Cache-Control", "no-cache");
      return res.sendFile(path.join(distDir, "index.html"));
    });
  }

  // ── Errors ───────────────────────────────────────────────────────────
  // eslint-disable-next-line no-unused-vars -- Express identifies error handlers by their 4-argument signature
  app.use((error, _req, res, _next) => {
    if (error?.type === "entity.parse.failed") return res.status(400).json({ error: "Malformed JSON body." });
    if (error?.type === "entity.too.large") return res.status(413).json({ error: "Request body is too large." });
    logger.error(`[server] unhandled error: ${error?.stack ?? error}`);
    return res.status(500).json({ error: "Something went wrong." });
  });

  return app;
}
