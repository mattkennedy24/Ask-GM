import { type ChildProcess, spawn } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

// The access-code gate is the one place where the server's configuration changes what the page does,
// so these tests run their own servers (on another port) with different codes.
const PORT = 3101;
const BASE = `http://127.0.0.1:${PORT}`;
const MOCK = "http://127.0.0.1:3199";

let server: ChildProcess | null = null;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function startServer(passcode: string) {
  await stopServer();
  server = spawn("node", ["server/index.js"], {
    env: { ...process.env, NODE_ENV: "production", PORT: String(PORT), ANTHROPIC_API_KEY: "test", ANTHROPIC_BASE_URL: MOCK, BETA_PASSCODE: passcode },
    stdio: "ignore",
  });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(100);
  }
  throw new Error("the test server did not start");
}

async function stopServer() {
  if (!server) return;
  server.kill();
  await sleep(300);
  server = null;
}

test.afterEach(stopServer);

const dialog = (page: Page) => page.getByRole("dialog");
const field = (page: Page) => page.getByLabel("Access code");

test("a stale stored code is re-checked on load, and the page behind the prompt is out of reach", async ({ page }) => {
  await startServer("current-code");
  await page.addInitScript(() => localStorage.setItem("betaKey", "an-old-code"));
  await page.goto(BASE);

  await expect(dialog(page)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("betaKey"))).toBeNull();
  expect(await page.evaluate(() => (document.querySelector(".app-shell") as HTMLElement & { inert: boolean }).inert)).toBe(true);
  await expect(field(page)).toBeFocused();
});

test("a wrong code is refused and not remembered; the right one unlocks and is remembered", async ({ page }) => {
  await startServer("let-me-in");
  await page.goto(BASE);

  await field(page).fill("nope");
  await page.getByRole("button", { name: "Enter", exact: true }).click();
  await expect(dialog(page).getByRole("alert")).toContainText(/isn't valid/);
  expect(await page.evaluate(() => localStorage.getItem("betaKey"))).toBeNull();

  await field(page).fill("let-me-in");
  await page.getByRole("button", { name: "Enter", exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("betaKey"))).toBe("let-me-in");

  await page.reload();
  await expect(page.locator("[data-piece]").first()).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);
});

test("when the code changes while the page is open, the next question asks for the new one and keeps the question", async ({ page }) => {
  await startServer("first-code");
  await page.addInitScript(() => {
    if (!localStorage.getItem("betaKey")) localStorage.setItem("betaKey", "first-code");
  });
  await page.goto(BASE);
  await expect(page.locator("[data-piece]").first()).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);

  await startServer("rotated-code");
  await page.getByRole("button", { name: "Best move?" }).click();
  await expect(dialog(page)).toBeVisible();

  await field(page).fill("first-code");
  await page.getByRole("button", { name: "Enter", exact: true }).click();
  await expect(dialog(page).getByRole("alert")).toContainText(/isn't valid/);

  await field(page).fill("rotated-code");
  await page.getByRole("button", { name: "Enter", exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);

  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator(".msg-gm").filter({ hasText: "quite natural" })).toBeVisible();
});

test("with no passcode configured there is no gate at all", async ({ page }) => {
  await startServer("");
  await page.goto(BASE);
  await expect(page.locator("[data-piece]").first()).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Best move?" }).click();
  await expect(page.locator(".msg-gm").filter({ hasText: "quite natural" })).toBeVisible();
});

test("guessing the code is throttled, and the message says so", async ({ page }) => {
  await startServer("secret");
  await page.goto(BASE);
  let message = "";
  for (let i = 0; i < 14 && !/too many/i.test(message); i++) {
    await field(page).fill(`guess-${i}`);
    await page.getByRole("button", { name: "Enter", exact: true }).click();
    await expect(dialog(page).getByRole("alert")).not.toBeEmpty();
    message = await dialog(page).getByRole("alert").innerText();
  }
  expect(message).toMatch(/too many/i);
});
