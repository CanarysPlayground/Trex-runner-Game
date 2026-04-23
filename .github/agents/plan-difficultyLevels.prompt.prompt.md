# Plan: Difficulty Levels – T-Rex Runner SDLC

## TL;DR
Add Easy/Medium/Hard difficulty to the T-Rex Runner game by wiring a UI selector to config-driven game parameters (speed, obstacle gap, score multiplier), then validating the feature end-to-end with Playwright + Jest tests and a GitHub Actions CI/CD pipeline.

---

## Phase 1 — UI Changes

**Goal:** Add difficulty selector and in-game difficulty display, testable and backward compatible.

1. In `ui/index.html`, add a `<select id="difficulty-select" aria-label="difficulty-select">` with options Easy/Medium/Hard (default: Medium), visible only in idle/game-over state
2. Add a `<span id="difficulty-display" aria-label="difficulty-display">` label to show active difficulty during gameplay (e.g., "Difficulty: Hard")
3. Hide selector when game transitions to `running`; show it again on game-over
4. All elements must have IDs and aria-labels for Playwright testability (per copilot-instructions)

**Files:** `ui/index.html`

---

## Phase 2 — Game Logic

**Goal:** Make speed, obstacle frequency, and score rate config-driven per difficulty.

5. Define a `DIFFICULTY_CONFIG` object in `ui/game.js`:
   - Easy: speed=4, obstacleGap=random(100–300), scoreMultiplier=1
   - Medium: speed=6 (current default), obstacleGap=random(0–200), scoreMultiplier=2
   - Hard: speed=9, obstacleGap=random(0–100), scoreMultiplier=3
6. In `startGame()`, read `#difficulty-select` value and load the matching config into module-level variables (`gameSpeed`, `obsGapMin`, `obsGapMax`, `scoreMult`)
7. Update `loop()`: replace hardcoded `obsX -= 6` with `obsX -= gameSpeed`; replace hardcoded random gap with `obsGapMin + random(obsGapMax - obsGapMin)`; apply `scoreMult` on score increment
8. Store active difficulty in `window.gameDifficulty` and expose `window.gameSpeed` for test assertions (parallel with step 7)
9. Update difficulty display span text in `startGame()` and clear on game-over

**Files:** `ui/game.js`
**Key symbols:** `startGame()`, `loop()`, `obsX`, `score`, `window.gameScore`

---

## Phase 3 — Testing

**Goal:** Validate all difficulty levels and core gameplay via automated tests.

### Playwright E2E Tests (new `tests/` directory)

10. **`tests/difficulty-ui.spec.ts`** — UI state tests:
    - Selector is visible before game starts
    - Selector is hidden once game is running
    - Difficulty display shows correct label for each selection
11. **`tests/difficulty-gameplay.spec.ts`** — Gameplay behavior tests:
    - For each difficulty: start game, wait N frames (via `page.waitForTimeout`), assert `window.gameSpeed` matches config
    - Assert `window.gameDifficulty` reflects selected value
    - Prefer state-based assertions over visual checks (per copilot-instructions)
12. **`tests/core-gameplay.spec.ts`** — Regression tests:
    - Game starts on button click
    - Game transitions from idle → running → over
    - High score updates after game over (via API intercept or DOM check)
13. Wire root `package.json` `test` script to `npx playwright test`

### Jest/Supertest API Tests (new `api/tests/` directory)

14. **`api/tests/score.test.js`**:
    - `GET /score` returns `{ highScore: 0 }` on fresh state
    - `POST /score/50` sets high score to 50
    - `POST /score/30` does not lower score below 50
    - Use `reset()` in `beforeEach`
15. Add `"test": "jest"` script to `api/package.json`

**Files:** `tests/` (new), `api/tests/` (new), root `package.json`, `api/package.json`
**Reference config:** `playwright.config.ts` (baseURL `http://localhost:8080`, webServer already configured)

---

## Phase 4 — CI/CD

**Goal:** Automated pipeline on every push/PR, failing on test failures.

16. Create `.github/workflows/ci.yml` with two jobs (can run in parallel):
    - **`api-tests`**: `cd api && npm install && npm test`
    - **`ui-tests`**: `npm install && npx playwright install chromium && npx playwright test`
17. Trigger on: `push` and `pull_request` to `main` branch
18. Both jobs must fail the pipeline on test failure (default Jest/Playwright behavior)
19. No deploy step needed — CI validation only (per requirements scope)

**Files:** `.github/workflows/ci.yml` (new)

---

## Relevant Files

- `ui/index.html` — add selector + display elements
- `ui/game.js` — `startGame()`, `loop()`, new `DIFFICULTY_CONFIG`
- `api/server.js` — read-only reference; no changes needed
- `playwright.config.ts` — read-only reference for test config
- `tests/` — new directory with 3 spec files
- `api/tests/` — new directory with 1 test file
- `.github/workflows/ci.yml` — new CI workflow

---

## Verification

1. Run `npx playwright test` locally — all 3 spec files pass across Easy/Medium/Hard
2. Run `cd api && npm test` — all score API assertions pass
3. Manually play game at each difficulty and confirm visually different feel
4. Push to a branch and confirm GitHub Actions CI workflow triggers and passes
5. Introduce a deliberate bug (e.g., wrong speed value) and confirm CI fails

---

## Decisions & Scope

- **High scores are NOT per-difficulty** — single global high score is retained (no API change)
- **Difficulty persists for the session** (in-memory JS variable, not localStorage)
- **Backward compatibility**: Medium difficulty = current behavior (speed 6, same obstacle gap)
- **No new routes** added to the API — feature is purely frontend
- **Out of scope**: leaderboards, difficulty-specific high scores, mobile support
