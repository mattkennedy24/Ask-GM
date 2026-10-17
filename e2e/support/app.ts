import { expect, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";

export const ACCESS_CODE = "sesame";
export const MOCK_URL = "http://127.0.0.1:3199";

export const isPhone = (info: TestInfo) => info.project.name === "iphone";

/** Open the app: by default as someone who has already entered the access code. */
export async function openApp(page: Page, { unlocked = true }: { unlocked?: boolean } = {}) {
  if (unlocked) await page.addInitScript((code) => localStorage.setItem("betaKey", code), ACCESS_CODE);
  await page.goto("/");
  await expect(page.locator("[data-piece]").first()).toBeVisible();
}

export const square = (page: Page, name: string) => page.locator(`[data-square="${name}"]`).first();

export async function playMove(page: Page, from: string, to: string) {
  await square(page, from).click();
  await square(page, to).click();
}

export async function playMoves(page: Page, moves: [string, string][]) {
  for (const [from, to] of moves) {
    await playMove(page, from, to);
    // Wait for the board to show the move before the next one is made.
    await expect(square(page, to).locator("[data-piece]")).toBeVisible();
  }
}

export async function pieceOn(page: Page, name: string): Promise<string | null> {
  const piece = square(page, name).locator("[data-piece]");
  // count() answers immediately; getAttribute() on a square with no piece would wait for one to appear.
  if ((await piece.count()) === 0) return null;
  return piece.first().getAttribute("data-piece");
}

/** The piece on a square once the board has settled (pieces glide, so a single look can catch one mid-move). */
export async function expectPiece(page: Page, name: string, piece: string | null) {
  await expect.poll(() => pieceOn(page, name), { message: `the piece on ${name}` }).toBe(piece);
}

/** Wait until Stockfish has published its three lines for the position on screen. */
export async function waitForEngineLines(page: Page) {
  await expect(page.locator(".engine-line")).toHaveCount(3, { timeout: 20_000 });
}

/** Phones show one section at a time; laptops show the chat all the time and Learn behind a tab. */
export async function goTo(page: Page, info: TestInfo, destination: "board" | "chat" | "learn") {
  if (isPhone(info)) {
    await page.locator("nav").getByRole("button", { name: destination === "board" ? "Board" : destination === "chat" ? "Chat" : "Learn" }).click();
  } else if (destination === "learn") {
    await page.getByRole("button", { name: "Learn", exact: true }).click();
  } else if (destination === "board") {
    await page.getByRole("button", { name: "Play", exact: true }).click();
  }
}

export async function ask(page: Page, question: string) {
  const input = page.locator('input[aria-label^="Ask "]');
  await input.fill(question);
  await input.press("Enter");
}

export async function mockRequests(request: APIRequestContext): Promise<{ system: string; messages: { role: string; content: string }[] }[]> {
  return (await request.get(`${MOCK_URL}/__requests`)).json();
}

export async function resetMock(request: APIRequestContext) {
  await request.delete(`${MOCK_URL}/__requests`);
}

/** Console errors and uncaught exceptions, so a test can assert that nothing went wrong quietly. */
export function collectProblems(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    // A wrong access code is a 401 by design.
    if (message.type() === "error" && !/status of 401/.test(message.text())) problems.push(`console.error: ${message.text()}`);
  });
  return problems;
}
