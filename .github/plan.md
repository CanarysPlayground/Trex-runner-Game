# SDLC Execution Plan — Difficulty Levels Feature (T-Rex Runner)

**TL;DR:** Add Easy / Medium / Hard difficulty selection to the T-Rex Runner by parameterising three hardcoded gameplay constants in `game.js`, adding a selector control to `index.html`, and validating every difficulty path through automated tests wired into the existing CI/CD pipeline.

---

## Current State Analysis

The following values in `ui/game.js` are currently hardcoded and drive the entire gameplay feel:

| Constant | Current Value | File Location |
|---|---|---|
| Obstacle speed | `obsX -= 6` | `loop()` function |
| Obstacle respawn gap | `Math.random()*200` | `loop()` function |
| Road stripe scroll speed | `stripeOffset + 6` | `loop()` function |
| Score increment | `score++` | `loop()` function |
| Cloud/bird speeds | individual per-object values | top of `game.js` |

These are the exact values that must become difficulty-driven. No other core logic requires change.

---

## Phase 1 — Feature Scoping & Difficulty Profile Definition

**Objective:** Define the precise parameter values for each difficulty and lock the feature contract before any implementation begins.

**Activities:**
- Define the three difficulty profiles as a configuration contract:

| Parameter | Easy | Medium (current) | Hard |
|---|---|---|---|
| Obstacle speed (px/frame) | 4 | 6 | 9 |
| Obstacle respawn gap (px beyond W) | 250–450 | 0–200 | 0–100 |
| Score multiplier | ×1 | ×1 | ×2 |
| Cloud/bird speed scale | ×0.6 | ×1 | ×1.4 |

- Confirm **Medium** exactly matches current behaviour (backward compatibility requirement)
- Define session persistence scope: difficulty held in `window.selectedDifficulty`, reset only on page reload — **not** persisted to the API
- Confirm the selector is locked (disabled) once `startGame()` is called and re-enabled on game over

**Quality Gate:** Difficulty profile table signed off. Medium profile numerically matches current hardcoded values. No API schema changes required.

**Expected Outcome:** Unambiguous feature contract. Developers, QEs, and the pipeline agent all work from the same parameter table.

---

## Phase 2 — UI Design & DOM Changes

**Objective:** Define all changes to `ui/index.html` needed to surface difficulty selection without disrupting existing layout.

**Activities:**
- Add a difficulty selector control (three radio buttons or a `<select>` dropdown) to the `#controls` section in `index.html`, positioned above the Start button
- Assign accessible `aria-label` attributes to each option for Playwright test targeting:
  - Container: `aria-label="difficulty-selector"`
  - Options: `aria-label="difficulty-easy"`, `aria-label="difficulty-medium"`, `aria-label="difficulty-hard"`
- Set **Medium** as the default selected value to preserve current out-of-the-box behaviour
- Add a `#difficulty-display` element to the `#hud` strip to show the active difficulty during play
- The selector must be visually disabled (greyed out) while `state === 'running'` and re-enabled on `state === 'over'`

**Quality Gate:** DOM structure reviewed against existing `#hud`, `#controls`, and `#game-wrapper` layout. All new elements have `aria-label` attributes. No existing element IDs or `aria-label` values changed (test selector stability).

**Expected Outcome:** Minimal, non-breaking UI addition. All new elements are immediately targetable by Playwright without additional selectors or workarounds.

---

## Phase 3 — Gameplay Logic Impact Assessment

**Objective:** Identify every line in `game.js` that must change and define the change precisely — without ambiguity for the implementing developer.

**Affected areas in `ui/game.js`:**

| Location | Current Code | Change Required |
|---|---|---|
| `loop()` — obstacle move | `obsX -= 6` | Replace `6` with `diffConfig.obsSpeed` |
| `loop()` — obstacle reset | `Math.random()*200` | Replace with `diffConfig.obsGapMin + Math.random()*diffConfig.obsGapRange` |
| `loop()` — stripe scroll | `stripeOffset + 6` | Replace `6` with `diffConfig.obsSpeed` (stripes match ground speed) |
| `loop()` — score increment | `score++` | Replace with `score += diffConfig.scoreMultiplier` |
| Cloud speed values | Individual `speed` properties | Multiply each by `diffConfig.cloudSpeedScale` at `startGame()` |
| Bird speed values | Individual `speed` properties | Multiply each by `diffConfig.cloudSpeedScale` at `startGame()` |
| `startGame()` | Reads no config today | Must read `window.selectedDifficulty` and resolve `diffConfig` before resetting loop variables |

**New additions (no existing code deleted):**
- A `DIFFICULTY_PROFILES` constant object at the top of `game.js` mapping `'easy' | 'medium' | 'hard'` → parameter sets
- `window.selectedDifficulty` initialised to `'medium'` on page load, updated by the selector's `change` event
- A `getDiffConfig()` helper that returns the active profile — called once in `startGame()`

**Backward compatibility check:** With the selector defaulting to Medium and `DIFFICULTY_PROFILES.medium` matching current hardcoded values exactly, existing behaviour is preserved for users who never interact with the selector.

**Quality Gate:** Every hardcoded value identified above is replaced. No magic numbers remain in the loop. `DIFFICULTY_PROFILES.medium` values numerically match the current constants before removal.

**Expected Outcome:** Clean, parameterised game loop. Difficulty profiles are declarative and independently testable.

---

## Phase 4 — Testing Strategy

**Objective:** Validate all three difficulty paths, the selector UI, backward compatibility, and regression of existing gameplay — automatically.

### Unit Tests (Jest)

| Scenario | Assertion |
|---|---|
| `DIFFICULTY_PROFILES.easy` returns correct speed and gap values | Values match the agreed profile table |
| `DIFFICULTY_PROFILES.medium` matches former hardcoded constants | Speed = 6, gap range = 0–200, multiplier = 1 |
| `DIFFICULTY_PROFILES.hard` returns correct values | Speed = 9, gap range = 0–100, multiplier = 2 |
| `getDiffConfig('invalid')` falls back to medium | Returns medium profile without throwing |

### E2E Tests (Playwright) — new spec file: `tests/difficulty-levels.spec.ts`

| Scenario | Risk Level | Key Assertion |
|---|---|---|
| Difficulty selector is visible and defaults to Medium on page load | High | `aria-label="difficulty-medium"` is checked by default |
| Selecting Easy before start changes `window.selectedDifficulty` | High | `page.evaluate(() => window.selectedDifficulty) === 'easy'` |
| Selector is disabled once game starts | Medium | `aria-label="difficulty-selector"` has `disabled` attribute during `state=running` |
| Selector re-enables after game over | Medium | Attribute removed after collision |
| Active difficulty label is shown in HUD during play | Medium | `#difficulty-display` text matches selected level |
| Game starts and runs without error on all three difficulties | High | No console errors; `window.gameScore` increments on each level |
| Score increments at ×2 on Hard | High | After 1 obstacle cleared on Hard, `window.gameScore === 2` |

### Regression Tests (existing suite must still pass)

- All existing `game-start.spec.ts`, `score-submission.spec.ts`, `high-score.spec.ts` tests pass unchanged
- Default (Medium) gameplay produces identical behaviour to pre-feature baseline

**Quality Gate:**
- All new unit tests pass
- All new E2E scenarios pass in headless mode
- Zero regressions in existing Playwright suite
- `window.selectedDifficulty` is readable by tests (confirms `game.js` exposes it on `window`)

**Expected Outcome:** Every difficulty path is automatically validated. Regression is proven, not assumed. QE manual effort = exploratory edge cases only.

---

## Phase 5 — CI/CD Considerations

**Objective:** Ensure the pipeline catches difficulty-related regressions on every PR without increasing pipeline run time beyond the 5-minute SLA.

**Pipeline impact assessment:**

| Stage | Change Required | Rationale |
|---|---|---|
| Unit test stage | Add `difficulty-profiles.test.js` to Jest run | New unit file; no config change needed |
| E2E stage | `tests/difficulty-levels.spec.ts` auto-discovered by Playwright | No `playwright.config` change needed if `testMatch` is `tests/**/*.spec.ts` |
| Lint stage | No change | New code follows existing style |
| `npm audit` stage | No change | No new dependencies introduced |
| Branch protection | No change | Existing gates still apply |

**Parallelisation opportunity:** The three difficulty E2E scenarios can run in parallel Playwright workers (`--workers=3`) — one per difficulty level — to keep total E2E time flat despite increased test count.

**Feature flag consideration:** If the difficulty selector must be dark-launched before full release, a `?difficulty=enabled` query-param guard can be placed on the selector rendering — the pipeline simply appends the param to the `baseURL` in the E2E job, removing the need for a separate feature-flag service.

**Quality Gate:** Pipeline total run time remains under 5 minutes after adding new tests. All 6 gates still enforce merge block. New test files are picked up without modifying `playwright.config` or `jest.config`.

**Expected Outcome:** Feature is fully validated end-to-end on every PR. Pipeline SLA maintained. Difficulty feature cannot regress silently.

---

## Scope Boundaries

**In scope:** Difficulty selector UI, parameterised game loop, `DIFFICULTY_PROFILES` config, session-scoped `window.selectedDifficulty`, unit and E2E tests, CI pipeline validation.

**Out of scope:** Persisting difficulty choice to the API or localStorage, per-difficulty leaderboards, animated difficulty transitions, mobile touch controls, server-side difficulty enforcement.

---

## Sequencing & Dependencies

```
Phase 1 (Profile definition) — must complete before any other phase
     │
     ├── Phase 2 (UI changes)      ─┐
     └── Phase 3 (Logic changes)   ─┤ parallel, independent
                                    │
                               Phase 4 (Tests) — depends on Phase 2 + 3 complete
                                    │
                               Phase 5 (CI wiring) — depends on Phase 4 test files existing
```
