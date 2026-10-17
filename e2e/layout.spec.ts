import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ask, goTo, isPhone, openApp, playMoves, square, waitForEngineLines } from "./support/app";

async function expectNoViolations(page: Page, label: string) {
  // Let entrance animations finish so contrast is measured at rest.
  await page.waitForTimeout(600);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]).analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(" ")}`);
  expect(summary, `accessibility problems on: ${label}`).toEqual([]);
}

test.describe("accessibility", () => {
  test("the access-code dialog", async ({ page }) => {
    await openApp(page, { unlocked: false });
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoViolations(page, "access code");
  });

  test("the board with the engine's lines", async ({ page }) => {
    await openApp(page);
    await waitForEngineLines(page);
    await expectNoViolations(page, "board and engine");
  });

  test("a conversation, the game menu and the load dialog", async ({ page }, info) => {
    await openApp(page);
    await playMoves(page, [["e2", "e4"], ["e7", "e5"]]);
    await goTo(page, info, "chat");
    await ask(page, "what now?");
    await expect(page.locator(".msg-gm").filter({ hasText: "quite natural" })).toBeVisible();
    await expectNoViolations(page, "chat");

    await page.getByRole("button", { name: "Game menu" }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    await expectNoViolations(page, "game menu");
    await page.getByRole("menuitem", { name: /Load a game/ }).click();
    await expectNoViolations(page, "load dialog");
  });

  test("the opening library and a lesson", async ({ page }, info) => {
    await openApp(page);
    await goTo(page, info, "learn");
    await expectNoViolations(page, "library");
    await page.getByRole("button", { name: /Ruy Lopez \(Spanish\)/ }).first().click();
    await page.getByRole("button", { name: "Next move" }).click();
    await expectNoViolations(page, "lesson");
  });

  test("a finished game, and a judged move", async ({ page }) => {
    await openApp(page);
    await playMoves(page, [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]);
    await expect(page.getByRole("region", { name: "Game result" })).toBeVisible();
    await expectNoViolations(page, "game over");
  });
});

test.describe("layout", () => {
  const sizes = [
    { name: "1920x1080", width: 1920, height: 1080 },
    { name: "1440x780", width: 1440, height: 780 },
    { name: "1280x720", width: 1280, height: 720 },
    { name: "1024x768", width: 1024, height: 768 },
    { name: "820x1180 tablet", width: 820, height: 1180 },
    { name: "375x667 small phone", width: 375, height: 667 },
    { name: "393x852 iPhone 16 Pro", width: 393, height: 852 },
    { name: "852x393 phone on its side", width: 852, height: 393 },
  ];

  for (const size of sizes) {
    test(`fits ${size.name}: no sideways scroll, a whole board, controls in reach`, async ({ page }, info) => {
      // The size is set by the test itself, so the same checks on a second device would repeat them.
      test.skip(isPhone(info), "sizes are set explicitly; checked once");
      await page.setViewportSize({ width: size.width, height: size.height });
      await openApp(page);
      await expect(page.locator(".board-frame")).toBeVisible();

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);

      const board = (await page.locator(".board-frame").boundingBox())!;
      expect(board.width).toBeGreaterThanOrEqual(160);
      expect(Math.abs(board.width - board.height)).toBeLessThan(8 + 4); // square, give or take the frame

      const wide = size.width >= 1024 || (size.width > size.height && size.width >= 700);
      if (wide) {
        // On a laptop the whole board sits in the window without scrolling the page.
        expect(board.y).toBeGreaterThanOrEqual(0);
        expect(board.y + board.height).toBeLessThanOrEqual(size.height + 1);
        await expect(page.locator("nav.bottom-nav")).toBeHidden();
      } else {
        await expect(page.locator("nav.bottom-nav")).toBeVisible();
      }
    });
  }

  test("the phone board runs edge to edge", async ({ page }, info) => {
    test.skip(!isPhone(info), "phone only");
    await openApp(page);
    const board = (await page.locator(".board-frame").boundingBox())!;
    expect(Math.abs(board.width - 393)).toBeLessThan(2);
  });

  test("the chat field is at least 16px, so iOS does not zoom the page when it is focused", async ({ page }, info) => {
    await openApp(page);
    await goTo(page, info, "chat");
    const size = await page.locator('input[aria-label^="Ask "]').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(16);
  });
});

test.describe("keyboard", () => {
  test("the game menu opens from the keyboard, moves with the arrows, and gives focus back", async ({ page }, info) => {
    test.skip(isPhone(info), "keyboard behaviour is the same on every screen");
    await openApp(page);
    const trigger = page.getByRole("button", { name: "Game menu" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitem", { name: "New game" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: /Load a game/ })).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(page.getByRole("menuitem", { name: "New game" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("a dialog takes focus, keeps it, and hands it back", async ({ page }, info) => {
    test.skip(isPhone(info), "keyboard behaviour is the same on every screen");
    await openApp(page);
    const trigger = page.getByRole("button", { name: "Game menu" });
    await trigger.click();
    await page.getByRole("menuitem", { name: /Load a game/ }).click();
    await expect(page.locator("textarea")).toBeFocused();

    // Tabbing round stays inside the dialog: the page behind it is inert.
    for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("arrow keys step through the game", async ({ page }, info) => {
    test.skip(isPhone(info), "a keyboard-only gesture");
    await openApp(page);
    await playMoves(page, [["e2", "e4"], ["e7", "e5"]]);
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => square(page, "e5").locator("[data-piece]").count()).toBe(0);
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => square(page, "e5").locator("[data-piece]").count()).toBe(1);
  });
});
