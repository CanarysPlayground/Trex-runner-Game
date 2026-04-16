---
name: trex-playwright.prompt
description: "Generate Playwright tests for the T-Rex Runner game. Use when writing E2E tests for game UI journeys, canvas interactions, score submission, high-score display, or API integration from the browser."
argument-hint: "Describe the scenario to test (e.g. 'game over score submission', 'high score display on load')"
agent: "agent"
tools: ["read_file", "create_file", "file_search"]
---

Generate Playwright end-to-end tests for the T-Rex Runner game using the standards and constraints below.

## Application Under Test

- **Game UI**: `http://localhost:8080` — HTML Canvas game served via `npx http-server`
- **High-Score API**: `http://localhost:3000` — Node.js Express server (`api/server.js`)
- **Entry point**: `ui/index.html` loads `ui/game.js`
- **Key DOM selectors** (from `ui/index.html`):
  - Canvas: `#game` / `aria-label="game-canvas"`
  - Start button: `#startBtn` / `aria-label="start-button"`
  - Status text: `#status` / `aria-label="game-status"`
  - High score display: `#highscore` / `aria-label="high-score"`

## Game-Specific Constraints

- The game runs inside an HTML `<canvas>` element — do **not** try to locate game objects (dino, cactus) as DOM elements; they are drawn pixels only
- Game state transitions: `idle` → `running` → `over` — driven by `window.gameScore` and canvas `draw` loop
- Jump is triggered by `Space` or `ArrowUp` keypress — use `page.keyboard.press('Space')`
- Game start requires clicking `#startBtn`; the button label changes to `Restart` after game over
- Score is written to `window.gameScore` — read it via `page.evaluate(() => window.gameScore)`
- The API call (`POST /score/:value`) is fired automatically on game over — intercept with `page.route` or `page.waitForRequest` rather than triggering it manually
- Canvas rendering is async — use `expect(canvas).toBeVisible()` and wait for `#status` text changes rather than pixel assertions

## Testing Standards

### Structure
- One `test.describe` block per feature area (e.g. `Game Start`, `Gameplay`, `Score Submission`, `High Score Display`)
- Use `test.beforeEach` to navigate to `http://localhost:8080` and wait for `#startBtn` to be visible
- Use `test.afterEach` to reset API state if the test mutated high score (call `POST /score/0` or use the API reset if available)
- Name tests as: `should <expected behaviour> when <condition>`

### Assertions
- Prefer `aria-label` selectors over CSS classes or IDs for resilience
- Use `expect(locator).toHaveText()` for status and score display checks
- Use `page.waitForResponse` or `page.route` to assert API calls — do not use arbitrary `page.waitForTimeout`
- Assert both the UI state and the API response where a user journey touches both layers

### Reliability
- Set `timeout` at the test level for slow canvas initialisation (recommend 10 000 ms)
- Use `page.waitForFunction` to poll `window.gameScore` changes rather than fixed sleeps
- All tests must pass in headless mode

### File Output
- Place tests in `tests/` at the workspace root
- Name files by feature: `tests/game-start.spec.ts`, `tests/score-submission.spec.ts`, `tests/high-score.spec.ts`
- Use TypeScript (`.spec.ts`)
- Import only from `@playwright/test` — no third-party assertion libraries

## Output Format

For each test file, produce:
1. The full file content (imports → describe → beforeEach → tests → afterEach)
2. A one-line comment above each `test()` block stating the risk level (`// Risk: High / Medium / Low`) mapped from the risk matrix
3. No placeholder or TODO comments — every test must be executable as written

## Example Invocations

- `/generate-playwright-tests game start and idle state`
- `/generate-playwright-tests game over triggers POST /score API call`
- `/generate-playwright-tests high score loaded from API on page load`
- `/generate-playwright-tests jump mechanic prevents collision`
