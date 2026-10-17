import { expect, test } from "@playwright/test";
import { expectPiece, goTo, isPhone, openApp, playMove } from "./support/app";

test.describe("opening lessons", () => {
  test("stepping through a lesson moves the board and shows the coaching note", async ({ page }, info) => {
    await openApp(page);
    await goTo(page, info, "learn");
    await expect(page.getByRole("heading", { name: "Opening lessons" })).toBeVisible();
    await expectPiece(page, "e2", "wP");

    await page.getByRole("button", { name: /Ruy Lopez \(Spanish\)/ }).first().click();
    await page.getByRole("button", { name: "Next move" }).click();
    await page.getByRole("button", { name: "Next move" }).click();
    await expectPiece(page, "e4", "wP");
    await expectPiece(page, "e5", "bP");

    // On a laptop the note sits beside the board; on a phone it sits right under it.
    const note = isPhone(info) ? page.locator(".feedback-note") : page.locator(".lesson-note");
    await expect(note).toContainText("Black mirrors the center");
  });

  test("the lesson board cannot be played on", async ({ page }, info) => {
    await openApp(page);
    await goTo(page, info, "learn");
    await page.getByRole("button", { name: /Ruy Lopez \(Spanish\)/ }).first().click();
    await playMove(page, "d2", "d4");
    await expectPiece(page, "d4", null);
    await expectPiece(page, "d2", "wP");
  });

  test("variations and auto-play work", async ({ page }, info) => {
    await openApp(page);
    await goTo(page, info, "learn");
    await page.getByRole("button", { name: /Ruy Lopez \(Spanish\)/ }).first().click();
    await page.getByRole("button", { name: "Berlin Defense" }).click();
    await page.getByRole("button", { name: "Start auto-play" }).click();
    await expect(page.locator('.lesson-moves [aria-current="true"]')).toBeVisible();
    await page.getByRole("button", { name: "Stop auto-play" }).click();
  });

  test("searching and filtering the library", async ({ page }, info) => {
    await openApp(page);
    await goTo(page, info, "learn");
    await page.getByLabel("Search openings").fill("najdorf");
    await expect(page.getByRole("button", { name: /Sicilian: Najdorf/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Ruy Lopez/ })).toHaveCount(0);

    await page.getByLabel("Search openings").fill("zzzz");
    await expect(page.getByText(/No openings match/)).toBeVisible();
  });

  test("a lesson's chat does not drag in the game's conversation", async ({ page }, info) => {
    await openApp(page);
    await goTo(page, info, "learn");
    await page.getByRole("button", { name: /Italian Game/ }).first().click();
    await goTo(page, info, "chat");
    await expect(page.getByText(/Studying the Italian Game/)).toBeVisible();
  });
});
