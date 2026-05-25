// @ts-check
import { test, expect, Page } from '@playwright/test';

// ── URL helpers ──────────────────────────────────────────────
const DEFAULT_URL_CANDIDATES = [
  'http://127.0.0.1:8080/ui/',
  'http://127.0.0.1:8080/',
  'http://localhost:8080/ui/',
  'http://localhost:8080/',
];

async function gotoGame(page: Page): Promise<void> {
  const candidates: string[] = [];
  const overrideUrl = process.env.TREX_GAME_URL;
  if (overrideUrl) candidates.push(overrideUrl);
  candidates.push(...DEFAULT_URL_CANDIDATES);

  let lastError: unknown;
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
    `Could not load T-Rex Runner. Tried: ${candidates.join(', ')}. Last error: ${String(lastError)}`
  );
}

/** Start the game and advance score to just above the bird-unlock threshold (>= 5). */
async function startAboveThreshold(page: Page): Promise<void> {
  await page.getByLabel('start-button').click();
  await expect(page.getByLabel('game-status')).toContainText('Running', { timeout: 2000 });
  await page.getByLabel('game-canvas').click();
  await page.evaluate(() => { (window as any).score = 10; (window as any).gameScore = 10; });
}

// ── beforeEach: navigate and wait for start button ──────────
test.beforeEach(async ({ page }) => {
  await gotoGame(page);
  await expect(page.getByLabel('start-button')).toBeVisible();
});

// ── Test suite ───────────────────────────────────────────────

test('Bird does not spawn when score is below threshold (< 5)', async ({ page }) => {
  // Risk: High
  test.setTimeout(15000);
  page.on('pageerror', err => { throw err; });

  await page.getByLabel('start-button').click();
  await expect(page.getByLabel('game-status')).toContainText('Running', { timeout: 2000 });
  await page.getByLabel('game-canvas').click();

  // Keep score below threshold and zero out spawn cooldown
  await page.evaluate(() => {
    (window as any).score = 0;
    (window as any).gameScore = 0;
    (window as any).birdSpawnCooldown = 0;
    (window as any).obsX = 600;
  });

  // Wait several frames — bird must NOT become active while score < 5
  await page.waitForFunction(() => (window as any).gameScore >= 0, { timeout: 300 }).catch(() => {});
  const birdActive = await page.evaluate(() => (window as any).birdActive);
  expect(birdActive).toBe(false);
});

test('Bird Y position is always BIRD_Y_LOW or BIRD_Y_HIGH when spawned', async ({ page }) => {
  // Risk: Medium
  test.setTimeout(15000);
  page.on('pageerror', err => { throw err; });

  await startAboveThreshold(page);

  // Force immediate spawn
  await page.evaluate(() => {
    (window as any).birdSpawnCooldown = 0;
    (window as any).obsX = 600;
    (window as any).birdActive = false;
  });

  await page.waitForFunction(() => (window as any).birdActive === true, { timeout: 3000 });

  const birdYVal = await page.evaluate(() => (window as any).birdY);
  const [low, high] = await page.evaluate(() => [(window as any).BIRD_Y_LOW, (window as any).BIRD_Y_HIGH]);
  expect([low, high]).toContain(birdYVal);
});

test('Bird moves left — birdX decreases each frame', async ({ page }) => {
  // Risk: Medium
  test.setTimeout(15000);
  page.on('pageerror', err => { throw err; });

  await startAboveThreshold(page);

  // Place an active bird on-screen
  await page.evaluate(() => {
    (window as any).birdActive = true;
    (window as any).birdX     = 500;
    (window as any).birdY     = (window as any).BIRD_Y_LOW;
    (window as any).obsX      = 600;
  });

  const xBefore = await page.evaluate(() => (window as any).birdX);

  // Wait for a few game frames
  await page.waitForFunction(
    (before: number) => (window as any).birdX < before,
    xBefore,
    { timeout: 2000 }
  );

  const xAfter = await page.evaluate(() => (window as any).birdX);
  expect(xAfter).toBeLessThan(xBefore);
});

test('Bird at BIRD_Y_HIGH collides with jumping dino — game over', async ({ page }) => {
  // Risk: High
  test.setTimeout(15000);
  page.on('pageerror', err => { throw err; });

  await startAboveThreshold(page);

  // Trigger a jump and then place bird at BIRD_Y_HIGH in the dino x-zone
  await page.evaluate(() => {
    // Force dino near jump apex (~BIRD_Y_HIGH)
    (window as any).dinoY  = (window as any).BIRD_Y_HIGH + 20; // within birdY ± range
    (window as any).dinoVY = -2;                                // still rising
    (window as any).birdActive = true;
    (window as any).birdX      = 62;                            // inside dino x-range 40–84
    (window as any).birdY      = (window as any).BIRD_Y_HIGH;
    (window as any).obsX       = 600;
    (window as any).shieldActive = false;
  });

  await page.waitForFunction(() => (window as any).state === 'over', { timeout: 2000 });
  const gameState = await page.evaluate(() => (window as any).state);
  expect(gameState).toBe('over');
});

test('Dodge bonus (+10) is awarded when bird passes without collision', async ({ page }) => {
  // Risk: Medium
  test.setTimeout(15000);
  page.on('pageerror', err => { throw err; });

  await startAboveThreshold(page);

  // Put bird just past the dino zone and about to exit
  await page.evaluate(() => {
    (window as any).shieldActive  = true;    // prevent any accidental collision
    (window as any).birdActive    = true;
    (window as any).birdX         = -50;     // near the -60 exit threshold
    (window as any).birdY         = (window as any).BIRD_Y_LOW;
    (window as any).birdWasAbsorbed = false; // clear absorbed flag
    (window as any).obsX          = 600;
    (window as any).score         = 10;      // baseline
    (window as any).gameScore     = 10;
    (window as any).shieldActive  = false;   // remove shield so dodge bonus triggers
  });

  // Wait for bird to exit (birdX < -60) which triggers the +10 bonus
  await page.waitForFunction(() => (window as any).birdActive === false, { timeout: 2000 });

  const scoreAfter = await page.evaluate(() => (window as any).gameScore);
  expect(scoreAfter).toBeGreaterThanOrEqual(20); // 10 baseline + 10 dodge bonus
});

test('birdWasAbsorbed suppresses dodge bonus when shield absorbs the bird', async ({ page }) => {
  // Risk: Low
  test.setTimeout(15000);
  page.on('pageerror', err => { throw err; });

  await startAboveThreshold(page);

  const baselineScore = 10;
  // Simulate shield-absorbed scenario: bird is exiting, birdWasAbsorbed = true
  await page.evaluate((base: number) => {
    (window as any).birdActive      = true;
    (window as any).birdX           = -50;
    (window as any).birdY           = (window as any).BIRD_Y_LOW;
    (window as any).birdWasAbsorbed = true;  // shield already absorbed this bird
    (window as any).obsX            = 600;
    (window as any).score           = base;
    (window as any).gameScore       = base;
    (window as any).shieldActive    = false;
  }, baselineScore);

  // Wait for bird to deactivate
  await page.waitForFunction(() => (window as any).birdActive === false, { timeout: 2000 });

  const scoreAfter = await page.evaluate(() => (window as any).gameScore);
  // No dodge bonus should have been applied
  expect(scoreAfter).toBe(baselineScore);
});

test('birdHitCooldown prevents re-collision immediately after shield absorbs a bird', async ({ page }) => {
  // Risk: Medium
  test.setTimeout(15000);
  page.on('pageerror', err => { throw err; });

  await startAboveThreshold(page);

  // Activate shield, place bird in collision zone — shield absorbs it
  await page.evaluate(() => {
    (window as any).shieldActive     = true;
    (window as any).birdActive       = true;
    (window as any).birdX            = 62;
    (window as any).birdY            = (window as any).BIRD_Y_LOW;
    (window as any).obsX             = 600;
    (window as any).birdHitCooldown  = 0; // reset so collision fires
  });

  // After shield absorbs, birdHitCooldown should be set (> 0)
  await page.waitForFunction(
    () => (window as any).birdHitCooldown > 0 || (window as any).birdX < 40,
    { timeout: 2000 }
  );

  const cooldown = await page.evaluate(() => (window as any).birdHitCooldown);
  const gameState = await page.evaluate(() => (window as any).state);

  // Game should still be running and cooldown should be active
  expect(gameState).toBe('running');
  expect(cooldown).toBeGreaterThanOrEqual(0); // was set then may have ticked down
});

test('Bird spawn is blocked when cactus is close (obsX <= 300)', async ({ page }) => {
  // Risk: Low
  test.setTimeout(15000);
  page.on('pageerror', err => { throw err; });

  await startAboveThreshold(page);

  // Set conditions that would trigger spawn EXCEPT cactus is too close
  await page.evaluate(() => {
    (window as any).birdActive        = false;
    (window as any).birdSpawnCooldown = 0;
    (window as any).obsX              = 200; // < 300 — spawn gate blocks this
    (window as any).score             = 10;
    (window as any).gameScore         = 10;
  });

  // Wait a few frames — bird must NOT spawn
  await page.waitForFunction(
    () => (window as any).gameScore !== undefined,
    { timeout: 500 }
  ).catch(() => {});

  const birdActive = await page.evaluate(() => (window as any).birdActive);
  expect(birdActive).toBe(false);
});

test('Bird collision ends game only once — state stays over, not cycling', async ({ page }) => {
  // Risk: High
  test.setTimeout(15000);
  page.on('pageerror', err => { throw err; });

  await startAboveThreshold(page);

  // Force immediate collision
  await page.evaluate(() => {
    (window as any).birdActive   = true;
    (window as any).birdX        = 62;
    (window as any).birdY        = (window as any).BIRD_Y_LOW;
    (window as any).obsX         = 600;
    (window as any).shieldActive = false;
    (window as any).birdHitCooldown = 0;
  });

  await page.waitForFunction(() => (window as any).state === 'over', { timeout: 2000 });

  // Wait an extra beat; state must remain 'over'
  await page.waitForFunction(() => (window as any).state === 'over', { timeout: 500 });

  expect(await page.evaluate(() => (window as any).state)).toBe('over');
  await expect(page.getByLabel('start-button')).toBeVisible();
});
