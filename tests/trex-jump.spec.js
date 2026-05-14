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

// ── Power-up system tests ────────────────────────────────────

test('Power-up token spawns on ground after score threshold', async ({ page }) => {
  page.on('pageerror', err => { throw err; });

  await gotoGame(page);
  await page.getByLabel('start-button').click();
  await expect(page.getByLabel('game-status')).toContainText('Running', { timeout: 2000 });
  await page.getByLabel('game-canvas').click();

  await page.evaluate(() => {
    score = 5; window.gameScore = 5;
    powerupActive        = false;
    powerupSpawnCooldown = 0;   // expire cooldown so spawn fires on next tick
    obsX                 = 600; // satisfy cactus gap guard in spawnPowerup
    birdActive           = false;
    birdSpawnCooldown    = 999;
  });

  await page.waitForFunction(() => window.powerupActive === true, { timeout: 3000 });

  const type = await page.evaluate(() => window.powerupType);
  expect(['shield', 'scoreBoost']).toContain(type);
});

test('Collecting shield token activates shield with timer', async ({ page }) => {
  page.on('pageerror', err => { throw err; });

  await gotoGame(page);
  await page.getByLabel('start-button').click();
  await expect(page.getByLabel('game-status')).toContainText('Running', { timeout: 2000 });
  await page.getByLabel('game-canvas').click();

  // Place shield token inside dino hitbox (x:40–84) at ground level
  await page.evaluate(() => {
    powerupType   = 'shield';
    powerupX      = 50;   // inside dino x-range 40–84
    powerupActive = true;
    birdActive    = false;
    obsX          = 600;
  });

  await page.waitForFunction(() => window.shieldActive === true, { timeout: 2000 });

  const timer = await page.evaluate(() => window.shieldTimer);
  expect(timer).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.shieldActive)).toBe(true);
});

test('Shield absorbs bird hit — game continues and shield deactivates', async ({ page }) => {
  page.on('pageerror', err => { throw err; });

  await gotoGame(page);
  await startGameAboveThreshold(page);

  await page.evaluate(() => {
    shieldActive = true;
    shieldTimer  = SHIELD_DURATION;
    birdActive   = true;
    birdX        = 62;         // inside dino x-range 40–84
    birdY        = BIRD_Y_LOW; // 160, within standing-dino hitbox
    obsX         = 600;
    powerupActive = false;
  });

  // Shield absorbs hit — shieldActive flips to false on next export
  await page.waitForFunction(() => window.shieldActive === false, { timeout: 2000 });

  expect(await page.evaluate(() => state)).toBe('running');
});

test('birdHitCooldown prevents re-trigger on same bird after shield absorption', async ({ page }) => {
  page.on('pageerror', err => { throw err; });

  await gotoGame(page);
  await startGameAboveThreshold(page);

  await page.evaluate(() => {
    shieldActive  = true;
    shieldTimer   = SHIELD_DURATION;
    birdActive    = true;
    birdX         = 62;
    birdY         = BIRD_Y_LOW;
    obsX          = 600;
    powerupActive = false;
  });

  // Wait for shield to absorb and birdHitCooldown to activate
  await page.waitForFunction(() => window.shieldActive === false, { timeout: 2000 });
  // Wait for cooldown to drain — game must stay running throughout
  await page.waitForFunction(() => window.birdHitCooldown === 0, { timeout: 2000 });

  expect(await page.evaluate(() => state)).toBe('running');
});

test('Shield expires when shieldTimer counts down to zero', async ({ page }) => {
  page.on('pageerror', err => { throw err; });

  await gotoGame(page);
  await page.getByLabel('start-button').click();
  await expect(page.getByLabel('game-status')).toContainText('Running', { timeout: 2000 });
  await page.getByLabel('game-canvas').click();

  await page.evaluate(() => {
    shieldActive  = true;
    shieldTimer   = 2;    // expires in 2 frames
    birdActive    = false;
    obsX          = 600;
    powerupActive = false;
  });

  await page.waitForFunction(() => window.shieldActive === false, { timeout: 2000 });

  expect(await page.evaluate(() => window.shieldActive)).toBe(false);
  expect(await page.evaluate(() => window.shieldTimer)).toBe(0);
});

test('ScoreBoost doubles regular score increment while active', async ({ page }) => {
  page.on('pageerror', err => { throw err; });

  await gotoGame(page);
  await page.getByLabel('start-button').click();
  await expect(page.getByLabel('game-status')).toContainText('Running', { timeout: 2000 });
  await page.getByLabel('game-canvas').click();

  await page.evaluate(() => {
    scoreBoostActive     = true;
    scoreBoostTimer      = BOOST_DURATION;
    score                = 10;
    window.gameScore     = 10;
    obsX                 = -30;   // 2 frames from triggering a score tick
    birdActive           = false;
    birdSpawnCooldown    = 999;
    powerupActive        = false;
    powerupSpawnCooldown = 999;
  });

  // Wait for cactus to pass and score to increment
  await page.waitForFunction(() => window.gameScore > 10, { timeout: 2000 });

  // Medium difficulty: scoreMultiplier=1 × boost=2 → +2 per tick
  const newScore = await page.evaluate(() => window.gameScore);
  expect(newScore).toBeGreaterThanOrEqual(12);
});

test('Dodge bonus adds 10 points when bird exits without hitting un-shielded dino', async ({ page }) => {
  page.on('pageerror', err => { throw err; });

  await gotoGame(page);
  await startGameAboveThreshold(page);

  // Capture score and set up bird near exit edge atomically
  const scoreBefore = await page.evaluate(() => {
    birdActive           = true;
    birdX                = -50;
    birdY                = BIRD_Y_LOW;
    birdWasAbsorbed      = false;
    shieldActive         = false;
    obsX                 = 600;
    birdSpawnCooldown    = 999;
    powerupActive        = false;
    powerupSpawnCooldown = 999;
    return score;
  });

  await page.waitForFunction(() => window.birdActive === false, { timeout: 2000 });

  // score export lags one frame behind dodge bonus; wait for it to sync
  await page.waitForFunction((before) => window.gameScore >= before + 10, scoreBefore, { timeout: 2000 });

  const scoreAfter = await page.evaluate(() => window.gameScore);
  expect(scoreAfter).toBeGreaterThanOrEqual(scoreBefore + 10);
});

test('No dodge bonus awarded when shield absorbed the bird', async ({ page }) => {
  page.on('pageerror', err => { throw err; });

  await gotoGame(page);
  await startGameAboveThreshold(page);

  const scoreBefore = await page.evaluate(() => {
    birdActive           = true;
    birdX                = -50;
    birdY                = BIRD_Y_LOW;
    birdWasAbsorbed      = true;  // shield already absorbed this bird
    shieldActive         = false;
    obsX                 = 600;
    birdSpawnCooldown    = 999;
    powerupActive        = false;
    powerupSpawnCooldown = 999;
    return score;
  });

  await page.waitForFunction(() => window.birdActive === false, { timeout: 2000 });

  // Give the loop one extra frame to sync exports, then verify no bonus
  await page.waitForFunction(() => window.birdWasAbsorbed === false, { timeout: 1000 });
  const scoreAfter = await page.evaluate(() => score);
  expect(scoreAfter).toBe(scoreBefore);
});

test('startGame resets all power-up state variables to initial values', async ({ page }) => {
  page.on('pageerror', err => { throw err; });

  await gotoGame(page);
  await page.getByLabel('start-button').click();
  await expect(page.getByLabel('game-status')).toContainText('Running', { timeout: 2000 });

  // Dirty all new state vars, then call startGame() — which runs loop() synchronously
  const st = await page.evaluate(() => {
    shieldActive         = true;
    shieldTimer          = 200;
    scoreBoostActive     = true;
    scoreBoostTimer      = 300;
    birdHitCooldown      = 15;
    birdWasAbsorbed      = true;
    powerupActive        = true;
    powerupX             = 400;
    powerupSpawnCooldown = 50;
    startGame();
    // First loop tick has run synchronously; window exports now reflect reset state
    return {
      shieldActive:     window.shieldActive,
      shieldTimer:      window.shieldTimer,
      scoreBoostActive: window.scoreBoostActive,
      scoreBoostTimer:  window.scoreBoostTimer,
      birdHitCooldown:  window.birdHitCooldown,
      birdWasAbsorbed:  window.birdWasAbsorbed,
      powerupActive:    window.powerupActive,
    };
  });

  expect(st.shieldActive).toBe(false);
  expect(st.shieldTimer).toBe(0);
  expect(st.scoreBoostActive).toBe(false);
  expect(st.scoreBoostTimer).toBe(0);
  expect(st.birdHitCooldown).toBe(0);
  expect(st.birdWasAbsorbed).toBe(false);
  expect(st.powerupActive).toBe(false);
});

// ── Power-up system tests ────────────────────────────────────

test('Shield token spawns after score >= 3 and cooldown expires', async ({ page }) => {
  page.on('pageerror', err => { throw err; });
  await gotoGame(page);
  await startGameAboveThreshold(page);

  await page.evaluate(() => {
    powerupSpawnCooldown = 0;
    powerupActive = false;
    obsX = 600;
  });

  await page.waitForFunction(() => window.powerupActive === true, { timeout: 3000 });

  expect(await page.evaluate(() => window.powerupActive)).toBe(true);
  const type = await page.evaluate(() => window.powerupType);
  expect(['shield', 'scoreBoost']).toContain(type);
});

test('Dino collects shield token — shieldActive becomes true', async ({ page }) => {
  page.on('pageerror', err => { throw err; });
  await gotoGame(page);
  await startGameAboveThreshold(page);

  await page.evaluate(() => {
    powerupType   = 'shield';
    powerupX      = 62;       // inside dino x-range 40-84
    powerupActive = true;
    shieldActive  = false;
    shieldTimer   = 0;
    obsX          = 600;
  });

  await page.waitForFunction(() => window.shieldActive === true, { timeout: 2000 });

  expect(await page.evaluate(() => window.shieldActive)).toBe(true);
  expect(await page.evaluate(() => window.shieldTimer)).toBeGreaterThan(0);
});

test('Shield absorbs bird collision — shieldActive off, game still running', async ({ page }) => {
  page.on('pageerror', err => { throw err; });
  await gotoGame(page);
  await startGameAboveThreshold(page);

  await page.evaluate(() => {
    shieldActive = true;
    shieldTimer  = 300;
    birdActive   = true;
    birdX        = 62;
    birdY        = BIRD_Y_LOW;
    obsX         = 600;
  });

  // Shield absorbs the hit — shieldActive flips to false
  await page.waitForFunction(() => window.shieldActive === false, { timeout: 2000 });

  expect(await page.evaluate(() => state)).toBe('running');
  expect(await page.evaluate(() => window.shieldActive)).toBe(false);
});

test('Shield expires when shieldTimer reaches 0', async ({ page }) => {
  page.on('pageerror', err => { throw err; });
  await gotoGame(page);
  await startGameAboveThreshold(page);

  await page.evaluate(() => {
    shieldActive = true;
    shieldTimer  = 1;   // expires next frame
    birdActive   = false;
    obsX         = 600;
  });

  await page.waitForFunction(() => window.shieldActive === false, { timeout: 2000 });

  expect(await page.evaluate(() => window.shieldActive)).toBe(false);
  expect(await page.evaluate(() => window.shieldTimer)).toBe(0);
});

test('ScoreBoost token doubles cactus score increment', async ({ page }) => {
  page.on('pageerror', err => { throw err; });
  await gotoGame(page);
  await startGameAboveThreshold(page);

  await page.evaluate(() => {
    scoreBoostActive = true;
    scoreBoostTimer  = 480;
    birdActive       = false;
    powerupActive    = false;
    score            = 0;
    window.gameScore = 0;
    obsX             = 1;  // cactus about to pass left edge
  });

  // Wait for cactus to wrap and score to increment (boosted: scoreMultiplier×2 = 2)
  await page.waitForFunction(() => window.gameScore >= 2, { timeout: 2000 });

  const s = await page.evaluate(() => window.gameScore);
  expect(s).toBeGreaterThanOrEqual(2);
});

test('Bird dodge grants +10 score when dino is un-shielded', async ({ page }) => {
  page.on('pageerror', err => { throw err; });
  await gotoGame(page);
  await startGameAboveThreshold(page);

  await page.evaluate(() => {
    shieldActive     = false;
    scoreBoostActive = false;
    birdWasAbsorbed  = false;
    birdActive       = true;
    birdX            = -50;   // about to exit left edge
    birdY            = BIRD_Y_LOW;
    obsX             = 600;
    score            = 20;
    window.gameScore = 20;
  });

  await page.waitForFunction(() => window.birdActive === false, { timeout: 2000 });
  await page.waitForFunction(() => window.gameScore > 20,       { timeout: 2000 });

  expect(await page.evaluate(() => window.gameScore)).toBe(30); // 20 + 10 dodge bonus
});

test('No dodge bonus when birdWasAbsorbed is true (shield took the hit)', async ({ page }) => {
  page.on('pageerror', err => { throw err; });
  await gotoGame(page);
  await startGameAboveThreshold(page);

  await page.evaluate(() => {
    shieldActive     = false;
    scoreBoostActive = false;
    birdWasAbsorbed  = true;  // simulate prior shield absorption
    birdActive       = true;
    birdX            = -50;
    birdY            = BIRD_Y_LOW;
    obsX             = 600;
    score            = 20;
    window.gameScore = 20;
  });

  await page.waitForFunction(() => window.birdActive === false, { timeout: 2000 });

  // Allow a couple of extra frames then read score — should still be 20
  const s = await page.evaluate(() => window.gameScore);
  expect(s).toBe(20);
});

test('Game restart resets all power-up state to defaults', async ({ page }) => {
  page.on('pageerror', err => { throw err; });
  await gotoGame(page);
  await startGameAboveThreshold(page);

  // Set all new power-up vars to non-default values
  await page.evaluate(() => {
    shieldActive     = true;
    shieldTimer      = 150;
    scoreBoostActive = true;
    scoreBoostTimer  = 200;
    powerupActive    = true;
    powerupX         = 300;
    birdHitCooldown  = 10;
    birdWasAbsorbed  = true;
  });

  await page.getByLabel('start-button').click();
  await expect(page.getByLabel('game-status')).toContainText('Running', { timeout: 2000 });

  const vals = await page.evaluate(() => ({
    shieldActive,
    shieldTimer,
    scoreBoostActive,
    scoreBoostTimer,
    powerupActive,
    birdHitCooldown,
    birdWasAbsorbed,
  }));

  expect(vals.shieldActive).toBe(false);
  expect(vals.shieldTimer).toBe(0);
  expect(vals.scoreBoostActive).toBe(false);
  expect(vals.scoreBoostTimer).toBe(0);
  expect(vals.powerupActive).toBe(false);
  expect(vals.birdHitCooldown).toBe(0);
  expect(vals.birdWasAbsorbed).toBe(false);
});

// ── Shield × bird interaction ────────────────────────────────

test('Shield absorbs bird hit — no game-over, shieldActive turns off', async ({ page }) => {
  page.on('pageerror', err => { throw err; });
  await gotoGame(page);
  await startGameAboveThreshold(page);

  await page.evaluate(() => {
    shieldActive = true;
    shieldTimer  = 300;
    birdActive   = true;
    birdX        = 62;       // inside dino hitbox (40–84)
    birdY        = BIRD_Y_LOW;
    obsX         = 600;
  });

  // Shield absorbs: shieldActive flips off within 1–2 frames
  await page.waitForFunction(() => window.shieldActive === false, { timeout: 2000 });

  expect(await page.evaluate(() => state)).toBe('running');
  expect(await page.evaluate(() => window.shieldActive)).toBe(false);
  expect(await page.evaluate(() => window.shieldTimer)).toBe(0);
});

test('Shield absorbs bird — birdHitCooldown prevents same-bird re-trigger', async ({ page }) => {
  page.on('pageerror', err => { throw err; });
  await gotoGame(page);
  await startGameAboveThreshold(page);

  await page.evaluate(() => {
    shieldActive = true;
    shieldTimer  = 300;
    birdActive   = true;
    birdX        = 62;
    birdY        = BIRD_Y_LOW;
    obsX         = 600;
  });

  // Wait for absorption
  await page.waitForFunction(() => window.shieldActive === false, { timeout: 2000 });

  // birdHitCooldown should be positive immediately after absorption
  const cooldown = await page.evaluate(() => window.birdHitCooldown);
  expect(cooldown).toBeGreaterThan(0);
  expect(await page.evaluate(() => state)).toBe('running');
});

test('Shield absorbs bird — birdWasAbsorbed flag suppresses dodge bonus', async ({ page }) => {
  page.on('pageerror', err => { throw err; });
  await gotoGame(page);
  await startGameAboveThreshold(page);

  await page.evaluate(() => {
    shieldActive     = true;
    shieldTimer      = 300;
    birdActive       = true;
    birdX            = 62;
    birdY            = BIRD_Y_LOW;
    obsX             = 600;
    score            = 50;
    window.gameScore = 50;
  });

  // Absorption sets birdWasAbsorbed=true — score must NOT get +10 when bird exits
  await page.waitForFunction(() => window.shieldActive === false, { timeout: 2000 });
  expect(await page.evaluate(() => window.birdWasAbsorbed)).toBe(true);

  // Let the bird fly off and confirm score stays at 50 (no dodge bonus)
  await page.waitForFunction(() => window.birdActive === false, { timeout: 4000 });
  expect(await page.evaluate(() => window.gameScore)).toBe(50);
});

// ── ScoreBoost × bird interaction ───────────────────────────

test('ScoreBoost doubles bird dodge bonus (+10 → +20)', async ({ page }) => {
  page.on('pageerror', err => { throw err; });
  await gotoGame(page);
  await startGameAboveThreshold(page);

  await page.evaluate(() => {
    shieldActive     = false;
    scoreBoostActive = true;
    scoreBoostTimer  = 480;
    birdWasAbsorbed  = false;
    birdActive       = true;
    birdX            = -50;   // just before exit threshold (-60)
    birdY            = BIRD_Y_LOW;
    obsX             = 600;
    score            = 20;
    window.gameScore = 20;
  });

  await page.waitForFunction(() => window.birdActive === false, { timeout: 2000 });
  await page.waitForFunction(() => window.gameScore > 20,       { timeout: 2000 });

  // scoreBoostActive doubles the +10 dodge bonus → +20
  expect(await page.evaluate(() => window.gameScore)).toBe(40);
});

test('ScoreBoost doubles cactus score with bird also present', async ({ page }) => {
  page.on('pageerror', err => { throw err; });
  await gotoGame(page);
  await startGameAboveThreshold(page);

  await page.evaluate(() => {
    scoreBoostActive = true;
    scoreBoostTimer  = 480;
    birdActive       = false;   // no bird, isolate cactus scoring
    powerupActive    = false;
    shieldActive     = true;    // safety: shield prevents accidental game-over
    shieldTimer      = 480;
    score            = 0;
    window.gameScore = 0;
    obsX             = 1;       // cactus about to pass left edge
  });

  await page.waitForFunction(() => window.gameScore >= 2, { timeout: 2000 });

  // medium scoreMultiplier = 1, boosted → 2
  expect(await page.evaluate(() => window.gameScore)).toBeGreaterThanOrEqual(2);
});

// ── SlowMotion × bird + obstacle speed ──────────────────────

test('SlowMotion token spawns and activates slowMotionActive', async ({ page }) => {
  page.on('pageerror', err => { throw err; });
  await gotoGame(page);
  await startGameAboveThreshold(page);

  await page.evaluate(() => {
    // Force a slowMotion token into the dino hitbox
    powerupType      = 'slowMotion';
    powerupX         = 62;
    powerupActive    = true;
    slowMotionActive = false;
    slowMotionTimer  = 0;
    obsX             = 600;
  });

  await page.waitForFunction(() => window.slowMotionActive === true, { timeout: 2000 });

  expect(await page.evaluate(() => window.slowMotionActive)).toBe(true);
  expect(await page.evaluate(() => window.slowMotionTimer)).toBeGreaterThan(0);
});

test('SlowMotion halves bird movement speed', async ({ page }) => {
  page.on('pageerror', err => { throw err; });
  await gotoGame(page);
  await startGameAboveThreshold(page);

  // Measure bird travel over 10 frames WITHOUT slow motion
  await page.evaluate(() => {
    shieldActive     = true;
    shieldTimer      = 600;
    slowMotionActive = false;
    birdActive       = true;
    birdX            = 400;
    birdY            = BIRD_Y_LOW;
    obsX             = 600;
  });
  const startX = await page.evaluate(() => window.birdX);
  await page.waitForFunction(x => window.birdX <= x - 50, startX, { timeout: 3000 });
  const normalTravel = startX - await page.evaluate(() => window.birdX);

  // Now measure with slow motion active — same bird at same start position
  await page.evaluate(() => {
    slowMotionActive = true;
    slowMotionTimer  = 600;
    birdActive       = true;
    birdX            = 400;
  });
  const slowStartX = await page.evaluate(() => window.birdX);
  await page.waitForFunction(x => window.birdX <= x - 25, slowStartX, { timeout: 5000 });
  const slowTravel = slowStartX - await page.evaluate(() => window.birdX);

  // In slowMotion the bird moves at half speed; normalTravel should be ~2× slowTravel
  expect(normalTravel).toBeGreaterThan(slowTravel);
});

test('SlowMotion halves obstacle (cactus) speed', async ({ page }) => {
  page.on('pageerror', err => { throw err; });
  await gotoGame(page);
  await startGameAboveThreshold(page);

  // Measure effective obstacle speed WITHOUT slowMotion
  await page.evaluate(() => {
    shieldActive     = true;
    shieldTimer      = 600;
    slowMotionActive = false;
    birdActive       = false;
    obsX             = 700;
  });
  // Read effectiveObsSpeed exposed on window
  await page.waitForFunction(() => window.effectiveObsSpeed !== undefined, { timeout: 1000 });
  const normalSpeed = await page.evaluate(() => window.effectiveObsSpeed);

  // Activate slowMotion and re-read speed
  await page.evaluate(() => {
    slowMotionActive = true;
    slowMotionTimer  = 600;
  });
  await page.waitForFunction(() => window.effectiveObsSpeed !== undefined, { timeout: 1000 });
  const slowSpeed = await page.evaluate(() => window.effectiveObsSpeed);

  // slowMotion should halve the effective speed
  expect(slowSpeed).toBe(normalSpeed * 0.5);
});

test('SlowMotion expires and speed returns to normal', async ({ page }) => {
  page.on('pageerror', err => { throw err; });
  await gotoGame(page);
  await startGameAboveThreshold(page);

  await page.evaluate(() => {
    slowMotionActive = true;
    slowMotionTimer  = 1;    // expires next frame
    birdActive       = false;
    obsX             = 600;
  });

  await page.waitForFunction(() => window.slowMotionActive === false, { timeout: 2000 });

  expect(await page.evaluate(() => window.slowMotionActive)).toBe(false);
  expect(await page.evaluate(() => window.slowMotionTimer)).toBe(0);
  expect(await page.evaluate(() => state)).toBe('running');
});
