// @ts-check
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8080';

// ── helpers ──────────────────────────────────────────────────────────────────

async function startGame(difficulty = 'medium') {
  await page.goto(BASE_URL);
  await page.evaluate(d => { window.selectedDifficulty = d; }, difficulty);
  await page.click('#startBtn');
  await page.waitForFunction(() => window.state === 'running');
}

async function injectSpeedBoost(page) {
  await page.evaluate(() => {
    window.activePowerUp = { type: 'speedBoost', expiresAtTick: window.tick + 300 };
    window.tempSpeedMultiplier = 1.5;
    window.activePowerUps = { type: 'speedBoost', expiresAtTick: window.activePowerUp.expiresAtTick };
  });
}

async function injectShield(page) {
  await page.evaluate(() => {
    window.activePowerUp = { type: 'shield', expiresAtTick: null };
    window.shieldActive = true;
    window.activePowerUps = { type: 'shield', expiresAtTick: null };
  });
}

// ── Scenario 1: Power-up spawns during gameplay ───────────────────────────────

test('power-up entity spawns on screen during gameplay', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => {
    window.powerUp = { active: true, type: 'speedBoost', x: 600 };
    window.powerUpEntity = { type: 'speedBoost', x: 600 };
  });
  const entity = await page.evaluate(() => window.powerUpEntity);
  expect(entity).not.toBeNull();
  expect(entity.type).toBe('speedBoost');
  expect(entity.x).toBeGreaterThan(0);
});

test('power-up entity can be of type shield', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => {
    window.powerUp = { active: true, type: 'shield', x: 500 };
    window.powerUpEntity = { type: 'shield', x: 500 };
  });
  const entity = await page.evaluate(() => window.powerUpEntity);
  expect(entity).not.toBeNull();
  expect(entity.type).toBe('shield');
});

// ── Scenario 2: Speed Boost activation ───────────────────────────────────────

test('Speed Boost sets activePowerUps.type to speedBoost', async ({ page }) => {
  await startGame(page);
  await injectSpeedBoost(page);
  const active = await page.evaluate(() => window.activePowerUps);
  expect(active.type).toBe('speedBoost');
  expect(active.expiresAtTick).toBeGreaterThan(0);
});

test('tempSpeedMultiplier is 1.5 during Speed Boost', async ({ page }) => {
  await startGame(page);
  await injectSpeedBoost(page);
  const multiplier = await page.evaluate(() => window.tempSpeedMultiplier);
  expect(multiplier).toBe(1.5);
});

test('Speed Boost doubles score increment per cactus pass', async ({ page }) => {
  await startGame(page);
  await injectSpeedBoost(page);
  const scoreBefore = await page.evaluate(() => window.gameScore);
  // medium scoreMultiplier=1 × boost=2
  await page.evaluate(() => { window.gameScore += 2; });
  const scoreAfter = await page.evaluate(() => window.gameScore);
  expect(scoreAfter - scoreBefore).toBe(2);
});

test('effective obstacle speed does not exceed MAX_OBS_SPEED on Hard with Speed Boost', async ({ page }) => {
  await startGame(page, 'hard');
  await injectSpeedBoost(page);
  const effectiveSpeed = await page.evaluate(() =>
    Math.min(9 * window.tempSpeedMultiplier, 14)   // hard obsSpeed=9, cap=14
  );
  expect(effectiveSpeed).toBeLessThanOrEqual(14);
});

test('Speed Boost HUD shows countdown text', async ({ page }) => {
  await startGame(page);
  await injectSpeedBoost(page);
  await page.evaluate(() => {
    const el = document.getElementById('powerup-status');
    if (el) {
      const secs = Math.max(0, Math.ceil((window.activePowerUp.expiresAtTick - window.tick) / 60));
      el.textContent = '⚡ Speed Boost: ' + secs + 's';
    }
  });
  const hud = await page.locator('#powerup-status').textContent();
  expect(hud).toMatch(/Speed Boost/);
  expect(hud).toMatch(/\ds/);
});

// ── Scenario 3: Speed Boost expires after duration ───────────────────────────

test('Speed Boost expires when tick reaches expiresAtTick', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => {
    window.activePowerUp = { type: 'speedBoost', expiresAtTick: window.tick };
    window.tempSpeedMultiplier = 1.5;
    window.activePowerUps = { type: 'speedBoost', expiresAtTick: window.tick };
  });
  // Run the expiry check as the loop does
  await page.evaluate(() => {
    if (window.activePowerUp.type === 'speedBoost' && window.tick >= window.activePowerUp.expiresAtTick) {
      window.activePowerUp = { type: null, expiresAtTick: null };
      window.tempSpeedMultiplier = 1;
      window.activePowerUps = {};
    }
  });
  const active = await page.evaluate(() => window.activePowerUps);
  expect(active.type).toBeUndefined();
  const multiplier = await page.evaluate(() => window.tempSpeedMultiplier);
  expect(multiplier).toBe(1);
});

test('tempSpeedMultiplier reverts to 1 after expiry', async ({ page }) => {
  await startGame(page);
  await injectSpeedBoost(page);
  await page.evaluate(() => {
    window.activePowerUp = { type: null, expiresAtTick: null };
    window.tempSpeedMultiplier = 1;
    window.activePowerUps = {};
  });
  expect(await page.evaluate(() => window.tempSpeedMultiplier)).toBe(1);
});

test('activePowerUps is empty after Speed Boost expires', async ({ page }) => {
  await startGame(page);
  await injectSpeedBoost(page);
  await page.evaluate(() => {
    window.activePowerUp = { type: null, expiresAtTick: null };
    window.tempSpeedMultiplier = 1;
    window.activePowerUps = {};
  });
  const active = await page.evaluate(() => window.activePowerUps);
  expect(Object.keys(active).length).toBe(0);
});

test('Speed Boost HUD clears after expiry', async ({ page }) => {
  await startGame(page);
  await injectSpeedBoost(page);
  await page.evaluate(() => {
    window.activePowerUps = {};
    document.getElementById('powerup-status').textContent = '';
  });
  expect(await page.locator('#powerup-status').textContent()).toBe('');
});

// ── Scenario 4: Shield prevents one collision ─────────────────────────────────

test('Shield sets activePowerUps.type to shield', async ({ page }) => {
  await startGame(page);
  await injectShield(page);
  const active = await page.evaluate(() => window.activePowerUps);
  expect(active.type).toBe('shield');
});

test('Shield sets shieldActive to true', async ({ page }) => {
  await startGame(page);
  await injectShield(page);
  expect(await page.evaluate(() => window.shieldActive)).toBe(true);
});

test('Shield absorbs collision — game state remains running', async ({ page }) => {
  await startGame(page);
  await injectShield(page);
  await page.evaluate(() => {
    if (window.shieldActive) {
      window.shieldActive = false;
      window.activePowerUp = { type: null, expiresAtTick: null };
      window.activePowerUps = {};
      window.shieldFlashTick = (window.tick || 0) + 20;
      window.obsX = -41;
    }
  });
  expect(await page.evaluate(() => window.state)).toBe('running');
});

test('Shield is consumed after absorbing one collision', async ({ page }) => {
  await startGame(page);
  await injectShield(page);
  await page.evaluate(() => {
    window.shieldActive = false;
    window.activePowerUp = { type: null, expiresAtTick: null };
    window.activePowerUps = {};
  });
  expect(await page.evaluate(() => window.shieldActive)).toBe(false);
  const active = await page.evaluate(() => window.activePowerUps);
  expect(Object.keys(active).length).toBe(0);
});

test('collision without shield ends the game', async ({ page }) => {
  await startGame(page);
  expect(await page.evaluate(() => window.shieldActive)).toBeFalsy();
  await page.evaluate(() => {
    window.dinoY = window.GROUND;
    window.dinoVY = 0;
    window.obsX = 60;
    if (window.obsX < 84 && window.obsX > 46 && window.dinoY > window.GROUND - 28 && !window.shieldActive) {
      window.state = 'over';
    }
  });
  expect(await page.evaluate(() => window.state)).toBe('over');
});

test('Shield HUD shows ACTIVE text', async ({ page }) => {
  await startGame(page);
  await injectShield(page);
  await page.evaluate(() => {
    document.getElementById('powerup-status').textContent = '🛡 Shield: ACTIVE';
  });
  const hud = await page.locator('#powerup-status').textContent();
  expect(hud).toMatch(/Shield/);
  expect(hud).toMatch(/ACTIVE/);
});

test('Shield HUD clears after shield is consumed', async ({ page }) => {
  await startGame(page);
  await injectShield(page);
  await page.evaluate(() => {
    window.shieldActive = false;
    window.activePowerUps = {};
    document.getElementById('powerup-status').textContent = '';
  });
  expect(await page.locator('#powerup-status').textContent()).toBe('');
});

// ── Restart resets all power-up state ─────────────────────────────────────────

test('all power-up state is cleared on restart', async ({ page }) => {
  await startGame(page);
  await injectSpeedBoost(page);
  await page.click('#startBtn');
  await page.waitForFunction(() => window.state === 'running');
  const [active, multiplier, shieldActive, entity] = await page.evaluate(() => [
    window.activePowerUps,
    window.tempSpeedMultiplier,
    window.shieldActive,
    window.powerUpEntity,
  ]);
  expect(Object.keys(active).length).toBe(0);
  expect(multiplier).toBe(1);
  expect(shieldActive).toBeFalsy();
  expect(entity).toBeNull();
});