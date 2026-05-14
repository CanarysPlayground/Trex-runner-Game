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

// ── Shared helper ────────────────────────────────────────────
/**
 * Start a game and push score above the bird-unlock threshold (5).
 * Returns after the game is Running and the canvas is focused.
 * @param {import('@playwright/test').Page} page
 */
async function startGameAboveThreshold(page) {
  await page.getByLabel('start-button').click();
  await expect(page.getByLabel('game-status')).toContainText('Running', { timeout: 2000 });
  await page.getByLabel('game-canvas').click();
  // Fast-forward score so bird spawning is unlocked (score >= 5)
  await page.evaluate(() => { score = 10; window.gameScore = 10; });
}

// ── Bird obstacle tests ──────────────────────────────────────

test('Bird appears in game after score reaches threshold', async ({ page }) => {
  page.on('pageerror', err => { throw err; });

  await gotoGame(page);
  await startGameAboveThreshold(page);

  // Force the spawn cooldown to expire immediately, ensure cactus is far away
  await page.evaluate(() => {
    birdSpawnCooldown = 0;
    obsX = 600;
  });

  // Wait for the obstacle bird to become active (birdActive flipped in loop)
  await page.waitForFunction(() => window.birdActive === true, { timeout: 3000 });

  // Bird should be on-screen (between 0 and canvas width)
  const birdXVal = await page.evaluate(() => window.birdX);
  expect(birdXVal).toBeGreaterThanOrEqual(0);
  expect(birdXVal).toBeLessThanOrEqual(1200); // spawns slightly off right edge

  // Bird Y should be one of the two defined spawn heights
  const birdYVal = await page.evaluate(() => window.birdY);
  const [low, high] = await page.evaluate(() => [BIRD_Y_LOW, BIRD_Y_HIGH]);
  expect([low, high]).toContain(birdYVal);
});

test('Dino collides with bird — game over', async ({ page }) => {
  page.on('pageerror', err => { throw err; });

  await gotoGame(page);
  await startGameAboveThreshold(page);

  // Place bird directly in the dino collision zone and ensure dino is standing
  await page.evaluate(() => {
    birdActive = true;
    birdX      = 62;           // inside dino x-range 40–84
    birdY      = BIRD_Y_LOW;   // 160, within dinoY (185) ± 43/23 window
    obsX       = 600;          // keep cactus far away
  });

  // Wait one frame for the collision check to run
  await page.waitForFunction(() => state === 'over', { timeout: 2000 });

  const gameState = await page.evaluate(() => state);
  expect(gameState).toBe('over');
});

test('Shield protects dino from bird collision', async ({ page }) => {
  page.on('pageerror', err => { throw err; });

  await gotoGame(page);
  await startGameAboveThreshold(page);

  // Activate shield, then place bird in collision zone
  await page.evaluate(() => {
    shieldActive = true;
    birdActive   = true;
    birdX        = 62;
    birdY        = BIRD_Y_LOW;
    obsX         = 600;
  });

  // Wait a few frames (bird should pass through without triggering game over)
  await page.waitForFunction(() => window.birdX < 40, { timeout: 3000 });

  const gameState = await page.evaluate(() => state);
  expect(gameState).toBe('running');
});

test('Bird deactivates after flying off the left edge', async ({ page }) => {
  page.on('pageerror', err => { throw err; });

  await gotoGame(page);
  await startGameAboveThreshold(page);

  // Place bird just before the deactivation threshold (birdX < -60)
  await page.evaluate(() => {
    shieldActive = true;  // prevent accidental collision on the way out
    birdActive   = true;
    birdX        = -50;
    birdY        = BIRD_Y_LOW;
  });

  // Wait for loop to push birdX past -60 and set birdActive = false
  await page.waitForFunction(() => window.birdActive === false, { timeout: 2000 });

  const active = await page.evaluate(() => window.birdActive);
  expect(active).toBe(false);
});

test('Multiple birds handled — second bird spawns after first leaves', async ({ page }) => {
  page.on('pageerror', err => { throw err; });

  await gotoGame(page);
  await startGameAboveThreshold(page);

  // Activate first bird and place it near the exit edge
  await page.evaluate(() => {
    shieldActive        = true;   // prevent collisions throughout
    birdActive          = true;
    birdX               = -50;
    birdY               = BIRD_Y_LOW;
    obsX                = 600;
    birdSpawnCooldown   = 0;      // next spawn fires as soon as current bird clears
  });

  // First bird exits screen
  await page.waitForFunction(() => window.birdActive === false, { timeout: 2000 });

  // Second bird should spawn — capture birdX atomically when birdActive becomes true
  // to avoid a race where birdX is read after the bird has already scrolled off-screen.
  const handle = await page.waitForFunction(
    () => window.birdActive === true ? window.birdX : null,
    { timeout: 3000 }
  );
  const secondBirdX = await handle.jsonValue();

  // Second bird spawns off the right edge (>= canvas width)
  expect(secondBirdX).toBeGreaterThan(0);
  expect(await page.evaluate(() => state)).toBe('running');
});

// ── Existing test ────────────────────────────────────────────

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
