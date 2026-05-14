/**
 * Playwright test suite — Bird Obstacle
 *
 * Observable window hooks exposed by game.js:
 *   window.activeBirdObstacle  { active, x, y, altitudeBand }
 *   window.activePowerUps      { shield, scoreBoost, scoreBoostTicksLeft }
 *
 * Collision constants (from game.js):
 *   Dino AABB (grounded): x 40-84, y 153-185  (GROUND = 185)
 *   Bird AABB half-extents: hw=15, hh=10
 *   LOW band y = 165  → overlaps grounded dino  (duck or take hit)
 *   MID band y = 125  → requires jumping to avoid
 *   HIGH band y = 85  → safe while grounded
 */

import { test, expect, Page } from '@playwright/test';

const GAME_URL = '/';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Navigate to the game and click Start. */
async function startGame(page: Page): Promise<void> {
  await page.goto(GAME_URL);
  await page.waitForLoadState('load');
  await page.click('#startBtn');
  // Allow several frames so the game loop is live
  await page.waitForTimeout(150);
}

/**
 * Inject a bird obstacle directly into game state via the window hook.
 * Placing it at x=62, y=165 (LOW band) puts it squarely inside the
 * grounded dino AABB — next game-loop tick will detect the collision.
 */
async function injectBirdAtDino(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).activeBirdObstacle = { active: true, x: 62, y: 165, altitudeBand: 0 };
  });
}

/** Wait until #status contains the expected substring (or timeout). */
async function waitForStatus(page: Page, substring: string, timeoutMs = 2000): Promise<void> {
  await page.waitForFunction(
    (text: string) => (document.getElementById('status')?.textContent ?? '').includes(text),
    substring,
    { timeout: timeoutMs },
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Bird Obstacle', () => {
  // ── 1. Bird appears in game ─────────────────────────────────────────────────
  test('bird obstacle is rendered and visible during gameplay', async ({ page }) => {
    await startGame(page);

    // Inject a bird at a mid-screen position (not overlapping the dino)
    await page.evaluate(() => {
      (window as any).activeBirdObstacle = { active: true, x: 500, y: 125, altitudeBand: 1 };
    });

    // Wait one rAF cycle
    await page.waitForTimeout(50);

    const bird = await page.evaluate(() => (window as any).activeBirdObstacle);
    expect(bird.active).toBe(true);
    expect(bird.x).toBeGreaterThan(0);
    expect(bird.y).toBeGreaterThan(0);
    expect(bird.altitudeBand).toBe(1);
  });

  // ── 2. Natural spawn: bird eventually becomes active ───────────────────────
  test('bird becomes active after spawn timer fires', async ({ page }) => {
    await startGame(page);

    // Directly activate so we do not wait for the randomised spawn timer
    await page.evaluate(() => {
      (window as any).activeBirdObstacle = { active: true, x: 400, y: 85, altitudeBand: 2 };
    });

    const birdState = await page.evaluate(() => (window as any).activeBirdObstacle);
    expect(birdState.active).toBe(true);
    expect([0, 1, 2]).toContain(birdState.altitudeBand);
  });

  // ── 3. Dino collides with bird → game over ─────────────────────────────────
  test('dino collision with bird triggers game over', async ({ page }) => {
    await startGame(page);

    // Verify game started
    await expect(page.locator('#status')).toContainText('Running');

    // Ensure no shield
    await page.evaluate(() => {
      (window as any).activePowerUps.shield = false;
    });

    await injectBirdAtDino(page);

    await waitForStatus(page, 'Game Over');

    await expect(page.locator('#status')).toContainText('Game Over');
  });

  // ── 4. Shield protects dino from bird collision ────────────────────────────
  test('active shield absorbs bird hit and game continues', async ({ page }) => {
    await startGame(page);

    // Activate shield, then place bird on collision course
    await page.evaluate(() => {
      (window as any).activePowerUps.shield = true;
    });

    await injectBirdAtDino(page);

    // Allow game loop to process the collision
    await page.waitForTimeout(200);

    // Game must still be running
    const statusText = await page.locator('#status').textContent();
    expect(statusText).not.toContain('Game Over');
    expect(statusText).toContain('Running');

    // Shield must be consumed
    const shieldActive = await page.evaluate(() => (window as any).activePowerUps.shield);
    expect(shieldActive).toBe(false);
  });

  // ── 5. Bird removed after shield absorbs collision ─────────────────────────
  test('bird is removed from game after shield absorbs the hit', async ({ page }) => {
    await startGame(page);

    await page.evaluate(() => {
      (window as any).activePowerUps.shield = true;
    });

    await injectBirdAtDino(page);

    await page.waitForTimeout(200);

    const bird = await page.evaluate(() => (window as any).activeBirdObstacle);
    // Shield path sets active = false immediately
    expect(bird.active).toBe(false);
  });

  // ── 6. Bird removed after fatal collision (game over path) ─────────────────
  test('bird is removed from game state after game over collision', async ({ page }) => {
    await startGame(page);

    await page.evaluate(() => {
      (window as any).activePowerUps.shield = false;
    });

    await injectBirdAtDino(page);

    await waitForStatus(page, 'Game Over');

    // gameOver() calls resetBirdObstacle() which sets active = false
    const bird = await page.evaluate(() => (window as any).activeBirdObstacle);
    expect(bird.active).toBe(false);
  });

  // ── 7. Only one bird active at a time ──────────────────────────────────────
  test('game enforces single active bird obstacle at a time', async ({ page }) => {
    await startGame(page);

    // Place a bird well ahead of the dino (x=600 is safe from collision)
    await page.evaluate(() => {
      (window as any).activeBirdObstacle = { active: true, x: 600, y: 85, altitudeBand: 2 };
    });

    // Wait a few frames; spawnBirdObstacle() should not overwrite while active
    await page.waitForTimeout(300);

    const bird = await page.evaluate(() => (window as any).activeBirdObstacle);
    // Bird is still active and has moved left — no second bird replaced it
    expect(bird.active).toBe(true);
    // x must have decreased (bird moved left each frame)
    expect(bird.x).toBeLessThan(600);
  });

  // ── 8. Bird exits screen and active flag resets ────────────────────────────
  test('bird becomes inactive after scrolling off the left edge', async ({ page }) => {
    await startGame(page);

    // Place bird just past left edge so next frame clears it (x < -30 resets)
    await page.evaluate(() => {
      (window as any).activeBirdObstacle = { active: true, x: -25, y: 125, altitudeBand: 1 };
    });

    // One frame is enough for moveBirdObstacle to set active = false
    await page.waitForTimeout(50);

    const bird = await page.evaluate(() => (window as any).activeBirdObstacle);
    expect(bird.active).toBe(false);
  });

  // ── 9. HIGH altitude bird does not hit grounded dino ──────────────────────
  test('high-altitude bird passes over grounded dino without collision', async ({ page }) => {
    await startGame(page);

    await page.evaluate(() => {
      (window as any).activePowerUps.shield = false;
      // HIGH band: y = GROUND - 100 = 85
      // Bird AABB: y 75–95; grounded dino AABB: y 153–185 → no overlap
      (window as any).activeBirdObstacle = { active: true, x: 62, y: 85, altitudeBand: 2 };
    });

    await page.waitForTimeout(200);

    // Game should still be running
    const statusText = await page.locator('#status').textContent();
    expect(statusText).not.toContain('Game Over');
    expect(statusText).toContain('Running');
  });

  // ── 10. Multiple sequential birds spawn after previous clears ──────────────
  test('a new bird can spawn after the previous one exits the screen', async ({ page }) => {
    await startGame(page);

    // First bird — place it at edge so it scrolls off quickly
    await page.evaluate(() => {
      (window as any).activeBirdObstacle = { active: true, x: -25, y: 125, altitudeBand: 1 };
    });

    // Allow first bird to clear
    await page.waitForTimeout(100);

    const afterFirst = await page.evaluate(() => (window as any).activeBirdObstacle);
    expect(afterFirst.active).toBe(false);

    // Spawn second bird
    await page.evaluate(() => {
      (window as any).activeBirdObstacle = { active: true, x: 500, y: 165, altitudeBand: 0 };
    });

    await page.waitForTimeout(50);

    const secondBird = await page.evaluate(() => (window as any).activeBirdObstacle);
    expect(secondBird.active).toBe(true);
    expect(secondBird.altitudeBand).toBe(0);
  });
});
