import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";
import gmPersonalities from "./gmPersonalities.js";

dotenv.config({ quiet: true });

const config = loadConfig();
const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../dist");

if (!config.hasApiKey) {
  console.warn(
    "\n⚠️  ANTHROPIC_API_KEY is not set — /api/chat will answer 503.\n" +
      "   Copy .env.example to .env and add your key:  cp .env.example .env\n",
  );
}
if (!config.betaPasscode) {
  console.warn(
    config.isProduction
      ? "⚠️  BETA_PASSCODE is not set: the access-code gate is DISABLED and the API is open to anyone with the URL."
      : "ℹ️  BETA_PASSCODE is not set: the access-code gate is disabled (fine for local development).",
  );
}

// The SDK retries transient failures itself (2x with backoff); the timeout keeps a
// stalled upstream from holding a request open for the SDK's default ten minutes.
// It is generous because a high-effort answer thinks first and can take well over 30s.
const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey || undefined,
  timeout: 90_000,
  maxRetries: 2,
});

const app = createApp({ config, anthropic, personalities: gmPersonalities, distDir });

const server = app.listen(config.port, () => {
  console.log(`Ask-GM server listening on port ${config.port}`);
  console.log(`  beta gate: ${config.betaPasscode ? "enabled" : "disabled"} · model: ${config.model}`);
});

// Longer than the 60s idle timeout of common load balancers, otherwise they occasionally
// reuse a connection Node has just closed and the client sees a spurious 502.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

function shutdown(signal) {
  console.log(`${signal} received, shutting down…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
