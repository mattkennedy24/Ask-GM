import { expect, test } from "@playwright/test";
import { ask, expectPiece, goTo, mockRequests, openApp, playMoves, resetMock } from "./support/app";

const BLUNDER_GAME = "1. e4 e5 2. Qh5 Nc6 3. Qxe5+ Nxe5 4. d4 Nc6 5. Nf3 d6 6. Bc4 Be7 *";

test.describe("judging the moves", () => {
  test.beforeEach(async ({ request }) => resetMock(request));

  test("a blunder played in a hurry is still judged, and can be taken back", async ({ page }) => {
    await openApp(page);
    await playMoves(page, [["e2", "e4"], ["e7", "e5"], ["d1", "h5"], ["b8", "c6"], ["h5", "e5"]]);

    const feedback = page.locator(".feedback");
    await expect(feedback).toContainText("Blunder.", { timeout: 25_000 });
    await expect(feedback).toContainText("3.Qxe5+");
    await expect(feedback).toContainText("The engine preferred");
    await expect(page.locator(".mark-blunder")).toHaveCount(1);

    await page.getByRole("button", { name: /Take it back and play/ }).click();
    await expect(page.locator(".moves")).not.toContainText("Qxe5");
    await expectPiece(page, "e5", "bP");
  });

  test("a loaded game is reviewed move by move, then summed up", async ({ page, request }, info) => {
    await openApp(page);
    await page.getByRole("button", { name: "Game menu" }).click();
    await page.getByRole("menuitem", { name: /Load a game/ }).click();
    await page.locator("textarea").fill(BLUNDER_GAME);
    await page.getByRole("button", { name: "Load", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Loaded a game of 6 moves" })).toBeVisible();

    const summary = page.locator(".review-summary");
    await expect(summary).toBeVisible({ timeout: 90_000 });
    await expect(summary).toContainText("1 blunder");
    await expect(summary).toContainText("no mistakes");

    await page.getByRole("button", { name: "Next mistake" }).click();
    await expect(page.locator('.move-chip[aria-current="true"]').first()).toContainText("Qxe5+");

    // Ask the coach about it: it is told what the engine found.
    await goTo(page, info, "chat");
    await page.getByRole("button", { name: "What were my biggest mistakes?" }).click();
    await expect(page.locator(".msg-gm").filter({ hasText: "quite natural" })).toBeVisible();
    const sent = (await mockRequests(request)).at(-1)!;
    expect(sent.system).toContain("GAME REVIEW (the engine's verdict on the costliest moves so far): 3.Qxe5+ (blunder");
    expect(sent.system).toContain("LAST MOVE REVIEW (from the engine): White's last move, 3.Qxe5+, was a blunder");
  });

  test("the coach is not told about a game that was started from a pasted position", async ({ page, request }, info) => {
    await openApp(page);
    await page.getByRole("button", { name: "Game menu" }).click();
    await page.getByRole("menuitem", { name: /Load a game/ }).click();
    await page.locator("textarea").fill("r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3");
    await page.getByRole("button", { name: "Load", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Loaded the position" })).toBeVisible();
    // A pasted position has fewer pieces than a full set, but nothing was "captured" in it.
    await expect(page.locator(".captured-piece")).toHaveCount(0);

    await goTo(page, info, "chat");
    await ask(page, "what now?");
    await expect(page.locator(".msg-gm").filter({ hasText: "quite natural" })).toBeVisible();
    const sent = (await mockRequests(request)).at(-1)!;
    // The position is quoted exactly, but no move list is claimed for it.
    expect(sent.system).toContain("FEN: r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3");
    expect(sent.system).not.toContain("Moves so far:");
  });

  test("bad input to the loader is refused with a reason, and Escape closes it", async ({ page }) => {
    await openApp(page);
    await page.getByRole("button", { name: "Game menu" }).click();
    await page.getByRole("menuitem", { name: /Load a game/ }).click();
    await page.locator("textarea").fill("1. e4 e5 2. Ke3 *");
    await page.getByRole("button", { name: "Load", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(/Could not read that/);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
