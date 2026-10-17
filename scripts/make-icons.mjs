#!/usr/bin/env node
/**
 * Draws the app icons (public/apple-touch-icon.png, icon-192.png, icon-512.png) from the brand: the italic
 * serif "GM" in paper on ink, set in the same Newsreader the app uses. Run it after changing the brand:
 *
 *   node scripts/make-icons.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "..");
const font = pathToFileURL(path.join(root, "node_modules/@fontsource-variable/newsreader/files/newsreader-latin-wght-italic.woff2")).href;

// Colours mirror --color-ink and --color-paper in src/styles/tokens.css.
const html = (size) => `<!doctype html>
<style>
  @font-face { font-family: "Newsreader Brand"; font-style: italic; font-weight: 200 800; src: url("${font}") format("woff2"); }
  html, body { margin: 0; width: ${size}px; height: ${size}px; background: #1a1915; }
  body { display: grid; place-items: center; }
  /* Kept inside the middle 60% so the mark survives a circular or rounded mask. */
  span { font: italic 700 ${Math.round(size * 0.36)}px/1 "Newsreader Brand", Georgia, serif; letter-spacing: -0.03em; color: #faf8f2; transform: translateY(-4%); }
</style>
<span>GM</span>`;

const browser = await chromium.launch();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ask-gm-icons-"));
try {
  for (const [file, size] of [["apple-touch-icon.png", 180], ["icon-192.png", 192], ["icon-512.png", 512]]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    const source = path.join(dir, `${size}.html`);
    fs.writeFileSync(source, html(size));
    await page.goto(pathToFileURL(source).href);
    await page.waitForFunction("document.fonts.status === 'loaded'");
    await page.screenshot({ path: path.join(root, "public", file) });
    await page.close();
    console.log(`wrote public/${file}`);
  }
} finally {
  await browser.close();
  fs.rmSync(dir, { recursive: true, force: true });
}
