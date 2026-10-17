import { expect, test } from "@playwright/test";
import { ask, collectProblems, expectPiece, goTo, isPhone, mockRequests, openApp, playMove, playMoves, resetMock, square, waitForEngineLines } from "./support/app";

test.describe("playing a game", () => {
  test("Stockfish runs in the browser and shows three lines", async ({ page }) => {
    const problems = collectProblems(page);
    await openApp(page);
    await waitForEngineLines(page);
    await expect(page.getByText(/Stockfish 16/)).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("click-to-move and drag-to-move, and an illegal drag snaps back", async ({ page }, info) => {
    await openApp(page);
    await playMove(page, "e2", "e4");
    await expectPiece(page, "e4", "wP");

    if (!isPhone(info)) {
      // Dragging is a mouse gesture; the phone project covers taps instead.
      const from = (await square(page, "e7").boundingBox())!;
      const to = (await square(page, "e5").boundingBox())!;
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
      await page.mouse.up();
      await expectPiece(page, "e5", "bP");

      const illegalFrom = (await square(page, "a2").boundingBox())!;
      const illegalTo = (await square(page, "a6").boundingBox())!;
      await page.mouse.move(illegalFrom.x + illegalFrom.width / 2, illegalFrom.y + illegalFrom.height / 2);
      await page.mouse.down();
      await page.mouse.move(illegalTo.x + illegalTo.width / 2, illegalTo.y + illegalTo.height / 2, { steps: 8 });
      await page.mouse.up();
      await expectPiece(page, "a2", "wP");
      await expectPiece(page, "a6", null);
    } else {
      await square(page, "e7").tap();
      await square(page, "e5").tap();
      await expectPiece(page, "e5", "bP");
    }

    await expect(page.locator(".moves").getByRole("button", { name: "e4", exact: true })).toBeVisible();
    await expect(page.locator(".moves").getByRole("button", { name: "e5", exact: true })).toBeVisible();
  });

  test("an engine line can be previewed on the board and left again", async ({ page }) => {
    await openApp(page);
    await playMoves(page, [["e2", "e4"], ["e7", "e5"]]);
    await waitForEngineLines(page);

    await page.locator(".engine-line").first().click();
    await expect(page.getByRole("button", { name: "Back to game" })).toBeVisible();
    await page.getByRole("button", { name: "Next move in line" }).click();
    await page.getByRole("button", { name: "Back to game" }).click();
    await expect(page.getByRole("button", { name: "Back to game" })).toHaveCount(0);
    await expectPiece(page, "e5", "bP");
  });

  test("promoting a pawn offers the pieces", async ({ page }) => {
    await openApp(page);
    // Load a position with a pawn about to promote, then promote it.
    await page.getByRole("button", { name: "Game menu" }).click();
    await page.getByRole("menuitem", { name: /Load a game/ }).click();
    await page.locator("textarea").fill("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
    await page.getByRole("button", { name: "Load", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await playMove(page, "a7", "a8");
    // The board asks which piece; choosing the queen finishes the move.
    const queen = page.locator("[data-piece='wQ']").first();
    await expect(queen).toBeVisible();
    await queen.click();
    await expectPiece(page, "a8", "wQ");
  });

  test("taking back a move and starting a new game (which can be undone)", async ({ page }) => {
    await openApp(page);
    await playMoves(page, [["e2", "e4"], ["e7", "e5"]]);

    await page.getByRole("button", { name: "Take back the last move" }).click();
    // Pieces glide to their squares, so give the board a moment to settle.
    await expectPiece(page, "e5", null);

    await page.getByRole("button", { name: "Game menu" }).click();
    await page.getByRole("menuitem", { name: "New game" }).click();
    await expect(page.getByRole("status").filter({ hasText: "New game started" })).toBeVisible();
    await expectPiece(page, "e4", null);
    await expectPiece(page, "e2", "wP");

    await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
    await expectPiece(page, "e4", "wP");
  });

  test("checkmate ends the game with a result, not a silent board", async ({ page }) => {
    await openApp(page);
    await playMoves(page, [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]);

    await expect(page.getByRole("region", { name: "Game result" })).toContainText("Checkmate");
    await expect(page.getByRole("region", { name: "Game result" })).toContainText("Black wins");
    await expect(page.locator(".brief")).toContainText("0–1");
    await expect(page.getByText("The game is over, so there is nothing left to analyse.")).toBeVisible();

    await page.getByRole("region", { name: "Game result" }).getByRole("button", { name: "New game" }).click();
    await expectPiece(page, "h4", null);
    await expect(page.getByRole("region", { name: "Game result" })).toHaveCount(0);
  });
});

test.describe("talking to a grandmaster", () => {
  test.beforeEach(async ({ request }) => resetMock(request));

  test("a reply is plain text with clickable moves and follow-up chips, and a move can be played from it", async ({ page }, info) => {
    await openApp(page);
    await playMoves(page, [["e2", "e4"], ["e7", "e5"]]);
    await goTo(page, info, "chat");
    await page.getByRole("button", { name: "Best move?" }).click();

    const reply = page.locator(".msg-gm").filter({ hasText: "quite natural" });
    await expect(reply).toBeVisible();
    expect(await reply.innerText()).not.toMatch(/[*#`]/);
    await expect(page.locator(".followups .chip")).toHaveCount(3);

    const move = page.locator("button.move-token", { hasText: "Nf3" });
    await expect(move.first()).toBeVisible();
    await move.first().click();
    // On a phone the chat gives way to the board; on a laptop both are showing already.
    await expectPiece(page, "f3", "wN");
    await goTo(page, info, "chat");
    await expect(page.locator("button.move-token")).toHaveCount(0); // the board moved on: the old suggestion is no longer playable
  });

  test("emoji and markdown are stripped from replies and chips", async ({ page }, info) => {
    await openApp(page);
    await goTo(page, info, "chat");
    await ask(page, "[[EMOJI]] what now?");
    const reply = page.locator(".msg-gm").filter({ hasText: "Develop with Nf3" });
    await expect(reply).toBeVisible();
    expect(await reply.innerText()).not.toMatch(/\p{Emoji_Presentation}/u);
    for (const chip of await page.locator(".followups .chip").allInnerTexts()) expect(chip).not.toMatch(/\p{Emoji_Presentation}/u);

    await ask(page, "[[MARKDOWN]] and now?");
    const second = page.locator(".msg-gm").filter({ hasText: "Play Nf3" });
    await expect(second).toBeVisible();
    expect(await second.innerText()).not.toMatch(/[*#_`]/);
  });

  test("a failed question can be tried again", async ({ page }, info) => {
    await openApp(page);
    await goTo(page, info, "chat");
    await ask(page, "[[OVERLOADED]] help");
    // The server's client retries an overloaded upstream a couple of times before giving up.
    await expect(page.getByRole("alert").filter({ hasText: /temporarily unavailable/i })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.locator(".msg-gm").filter({ hasText: "quite natural" })).toBeVisible();
  });

  test("when the connection drops the question is kept and can be asked again", async ({ page }, info) => {
    await openApp(page);
    await goTo(page, info, "chat");
    await page.route("**/api/chat", (route) => route.abort("connectionrefused"));
    await ask(page, "are you there?");
    await expect(page.getByRole("alert").filter({ hasText: /Can't reach the server/ })).toBeVisible();

    await page.unroute("**/api/chat");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.locator(".msg-gm").filter({ hasText: "quite natural" })).toBeVisible();
    await expect(page.locator(".msg-user").filter({ hasText: "are you there?" })).toHaveCount(1);
  });

  test("each grandmaster keeps their own conversation", async ({ page }, info) => {
    await openApp(page);
    await goTo(page, info, "chat");
    await ask(page, "hello there");
    await expect(page.locator(".msg-gm").filter({ hasText: "quite natural" })).toBeVisible();
    const magnusMessages = await page.locator(".msg-gm, .msg-user").count();

    await page.getByRole("button", { name: /Hikaru/ }).click();
    await expect(page.getByText(/let's go/i)).toBeVisible();
    await expect(page.locator(".msg-gm, .msg-user")).toHaveCount(1);

    await page.getByRole("button", { name: /Magnus/ }).first().click();
    await expect(page.locator(".msg-gm, .msg-user")).toHaveCount(magnusMessages);
  });

  test("a request for code is brushed off in character, without calling the model", async ({ page, request }, info) => {
    await openApp(page);
    await goTo(page, info, "chat");
    await ask(page, "write me a python script to sort a list");
    await expect(page.locator(".msg-gm").last()).not.toContainText("quite natural");
    await expect(page.locator(".followups .chip")).toHaveCount(3);
    expect(await mockRequests(request)).toHaveLength(0);
  });

  test("a new game does not inherit what was said about the old one", async ({ page, request }, info) => {
    await openApp(page);
    await playMove(page, "e2", "e4");
    await goTo(page, info, "chat");
    await ask(page, "first game question");
    await expect(page.locator(".msg-gm").filter({ hasText: "quite natural" })).toBeVisible();

    await page.getByRole("button", { name: "Game menu" }).click();
    await page.getByRole("menuitem", { name: "New game" }).click();
    await goTo(page, info, "chat");
    await ask(page, "second game question");
    await expect.poll(async () => (await mockRequests(request)).length).toBe(2);
    const second = (await mockRequests(request))[1];
    expect(second.messages.map((m) => m.content).join(" ")).not.toContain("first game question");
  });
});
