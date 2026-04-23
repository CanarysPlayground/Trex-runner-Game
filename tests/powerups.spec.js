const { test, expect } = require('@playwright/test');

const DINO_DRAW_X = 40;
const DINO_DRAW_WIDTH = 44;
const DINO_DRAW_HEIGHT = 44;
const MIN_JUMP_HEIGHT_PIXELS = 8;

/**
 * @param {import('@playwright/test').Page} page
 */
async function installDinoTracker(page) {
  await page.evaluate(({ dinoX, dinoWidth, dinoHeight }) => {
    window.__dinoFrames = [];

    if (window.__dinoTrackerInstalled) return;

    const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function patchedDrawImage(...args) {
      if (
        args.length >= 5 &&
        args[1] === dinoX &&
        args[3] === dinoWidth &&
        args[4] === dinoHeight
      ) {
        window.__dinoFrames.push(args[2]);
      }
      return originalDrawImage.apply(this, args);
    };

    window.__dinoTrackerInstalled = true;
  }, { dinoX: DINO_DRAW_X, dinoWidth: DINO_DRAW_WIDTH, dinoHeight: DINO_DRAW_HEIGHT });
}

test('dino jumps when Space is pressed while game is running', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  await page.goto('http://127.0.0.1:8080');
  await installDinoTracker(page);

  await page.getByLabel('start-button').click();
  await expect(page.getByLabel('game-status')).toContainText('Running');

  await page.evaluate(() => {
    window.__dinoFrames = [];
  });

  await page.keyboard.press('Space');
  await page.waitForFunction(
    minJumpHeight => {
      const frames = window.__dinoFrames;
      if (frames.length <= 1) return false;
      let minY = frames[0];
      let maxY = frames[0];
      for (let i = 1; i < frames.length; i++) {
        if (frames[i] < minY) minY = frames[i];
        if (frames[i] > maxY) maxY = frames[i];
      }
      return maxY - minY >= minJumpHeight;
    },
    MIN_JUMP_HEIGHT_PIXELS
  );

  const jumpMetrics = await page.evaluate(() => {
    const frames = window.__dinoFrames;
    let minY = frames[0];
    let maxY = frames[0];
    for (let i = 1; i < frames.length; i++) {
      if (frames[i] < minY) minY = frames[i];
      if (frames[i] > maxY) maxY = frames[i];
    }
    return {
      count: frames.length,
      minY,
      maxY,
      score: window.gameScore,
      url: window.location.href,
    };
  });

  expect(jumpMetrics.count).toBeGreaterThan(0);
  expect(jumpMetrics.minY).toBeLessThan(jumpMetrics.maxY - MIN_JUMP_HEIGHT_PIXELS);
  expect(jumpMetrics.score).toBeGreaterThanOrEqual(0);
  expect(jumpMetrics.url).toContain('127.0.0.1:8080');
  expect(pageErrors).toEqual([]);
});
