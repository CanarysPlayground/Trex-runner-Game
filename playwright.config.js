// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: process.env.TREX_GAME_URL || 'http://127.0.0.1:8080/',
    // Capture traces on first retry so CI artifacts contain full context for failures
    trace: 'on-first-retry',
    // Screenshot on failure for quick visual inspection in the Actions summary
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
