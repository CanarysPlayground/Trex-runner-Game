// @ts-check
const { test, expect } = require('@playwright/test');

const DEFAULT_URL_CANDIDATES = [
  'http://127.0.0.1:8080/ui/',
  'http://127.0.0.1:8080/',
];

/**
 * Navigates to the game UI.
 *
 * By default it tries `/ui/` first (when serving the repo root), then `/` (when serving the `ui` folder).
 * You can override with `TREX_GAME_URL`.
 *
 * @param {import('@playwright/test').Page} page
 */
async function gotoGame(page) {
  /** @type {string[]} */
  const candidates = [];

  const overrideUrl = process.env.TREX_GAME_URL;
  if (overrideUrl) candidates.push(overrideUrl);
  candidates.push(...DEFAULT_URL_CANDIDATES);

  let lastError;
  for (const url of candidates) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await expect(page.getByLabel('start-button')).toBeVisible({ timeout: 1500 });
      return;
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(
    `Could not load the T-Rex Runner UI. Tried: ${candidates.join(', ')}. ` +
      `Set TREX_GAME_URL to your actual URL. Last error: ${String(lastError)}`
  );
}

test('Space key triggers a dino jump', async ({ page }) => {
  page.on('pageerror', err => {
    throw err;
  });

  await gotoGame(page);

  // Start the run
  await page.getByLabel('start-button').click();
  await expect(page.getByLabel('game-status')).toContainText('Running', { timeout: 2000 });

  // Focus the page for keyboard input
  await page.getByLabel('game-canvas').click();

  // Capture baseline physics values from the page.
  const ground = await page.evaluate(() => GROUND);
  const yBefore = await page.evaluate(() => dinoY);
  expect(yBefore).toBe(ground);

  // Act
  await page.keyboard.press('Space');

  // Assert: within a short time, the dino should rise above ground (smaller Y means higher on the canvas)
  await page.waitForFunction(g => dinoY < g, ground, { timeout: 1000 });

  // Optional sanity: it should land back on the ground within the jump arc
  await page.waitForFunction(g => dinoY === g, ground, { timeout: 2000 });
});
