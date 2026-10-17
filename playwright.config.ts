import { defineConfig, devices } from "@playwright/test";

const APP_PORT = 3100;
const MOCK_PORT = 3199;

/**
 * End-to-end tests run the real app (built, served by the real Express server, with the real Stockfish
 * in the browser) against a stand-in for the Anthropic API. See e2e/support/mock-anthropic.mjs.
 *
 *   npm run e2e                 everything, on a laptop and on an iPhone-sized screen
 *   npx playwright test --project=iphone e2e/play.spec.ts
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  // One app server and one mock share a request log, so the tests run one at a time.
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "laptop", use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
    {
      name: "iphone",
      use: { ...devices["iPhone 15 Pro"], browserName: "chromium", viewport: { width: 393, height: 852 } },
      // The access-code gate behaves the same on every screen; one project is enough for it.
      testIgnore: /gate\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: "node e2e/support/mock-anthropic.mjs",
      url: `http://127.0.0.1:${MOCK_PORT}/__health`,
      reuseExistingServer: !process.env.CI,
      env: { MOCK_PORT: String(MOCK_PORT) },
    },
    {
      command: "npm run build && node server/index.js",
      url: `http://127.0.0.1:${APP_PORT}/api/health`,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: "production",
        PORT: String(APP_PORT),
        BETA_PASSCODE: "sesame",
        ANTHROPIC_API_KEY: "test-key",
        ANTHROPIC_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
      },
    },
  ],
});
