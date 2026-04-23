const { test, expect } = require('@playwright/test');

/**
 * @param {import('@playwright/test').Page} page
 */
async function installDinoTracker(page) {
  await page.evaluate(() => {
    window.__dinoFrames = [];

    if (window.__dinoTrackerInstalled) return;

    const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function patchedDrawImage(...args) {
      if (args.length >= 5 && args[1] === 40 && args[3] === 44 && args[4] === 44) {
        window.__dinoFrames.push(args[2]);
      }
      return originalDrawImage.apply(this, args);
    };

    window.__dinoTrackerInstalled = true;
  });
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
  await page.waitForTimeout(500);

  const jumpMetrics = await page.evaluate(() => {
    const frames = window.__dinoFrames;
    return {
      count: frames.length,
      minY: Math.min(...frames),
      maxY: Math.max(...frames),
      score: window.gameScore,
      url: window.location.href,
    };
  });

  expect(jumpMetrics.count).toBeGreaterThan(0);
  expect(jumpMetrics.minY).toBeLessThan(jumpMetrics.maxY - 8);
  expect(jumpMetrics.score).toBeGreaterThanOrEqual(0);
  expect(jumpMetrics.url).toContain('127.0.0.1:8080');
  expect(pageErrors).toEqual([]);
});
